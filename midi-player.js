(()=>{
 class MidiPlayer{
  constructor(tracks){
   this.tracks=tracks||[];
   this.context=null;
   this.master=null;
   this.muted=false;
   this.events=[];
   this.duration=0;
   this.eventIndex=0;
   this.loopIndex=0;
   this.startTime=0;
   this.timer=null;
   this.activeNotes=new Map();
   this.channels=Array.from({length:16},()=>({program:0,volume:100,expression:127,pan:64}));
   this.noiseBuffer=null;
  }

  async startRandom(){
   if(!this.tracks.length)return;
   const index=Math.floor(Math.random()*this.tracks.length);
   const track=this.tracks[index];
   const bytes=decodeBase64(track.data);
   const parsed=parseMidi(bytes);
   this.events=parsed.events;
   this.duration=Math.max(1,parsed.duration);
   this.eventIndex=0;
   this.loopIndex=0;
   this.channels=Array.from({length:16},()=>({program:0,volume:100,expression:127,pan:64}));
   this.ensureAudio();
   this.startTime=this.context.currentTime+0.15;
   this.timer=setInterval(()=>this.schedule(),25);
   this.schedule();
   try{await this.context.resume()}catch{}
  }

  ensureAudio(){
   if(this.context)return;
   const Context=window.AudioContext||window.webkitAudioContext;
   if(!Context)throw new Error('Web Audio no está disponible en este navegador.');
   this.context=new Context();
   this.master=this.context.createGain();
   this.master.gain.value=this.muted?0:0.17;
   this.master.connect(this.context.destination);
  }

  activate(){
   if(this.context&&this.context.state==='suspended')this.context.resume().catch(()=>{});
  }

  toggleMute(){
   this.muted=!this.muted;
   if(this.context&&this.master){
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(this.muted?0:0.17,this.context.currentTime,0.035);
   }
   return this.muted;
  }

  schedule(){
   if(!this.context||!this.events.length)return;
   const horizon=this.context.currentTime+0.25;
   let processed=0;
   while(processed<2000){
    if(this.eventIndex>=this.events.length){
     this.loopIndex++;
     this.eventIndex=0;
    }
    const event=this.events[this.eventIndex];
    const at=this.startTime+this.loopIndex*this.duration+event.time;
    if(at>horizon)break;
    this.dispatch(event,Math.max(at,this.context.currentTime+0.005));
    this.eventIndex++;
    processed++;
   }
  }

  dispatch(event,at){
   const channel=this.channels[event.channel];
   if(event.type===0xC0){channel.program=event.a;return}
   if(event.type===0xB0){
    if(event.a===7)channel.volume=event.b;
    if(event.a===11)channel.expression=event.b;
    if(event.a===10)channel.pan=event.b;
    return;
   }
   if(event.type===0x90&&event.b>0){this.noteOn(event.channel,event.a,event.b,at);return}
   if(event.type===0x80||(event.type===0x90&&event.b===0))this.noteOff(event.channel,event.a,at);
  }

  noteOn(channel,note,velocity,at){
   const ctx=this.context;
   const program=this.channels[channel].program;
   const isDrum=channel===9;
   const amp=(velocity/127)*(this.channels[channel].volume/127)*(this.channels[channel].expression/127)*0.22;
   const voiceGain=ctx.createGain();
   const pan=ctx.createStereoPanner?ctx.createStereoPanner():null;
   if(pan){pan.pan.value=(this.channels[channel].pan-64)/64;voiceGain.connect(pan);pan.connect(this.master)}else voiceGain.connect(this.master);

   let source;
   let envelope;
   if(isDrum&&note!==35&&note!==36){
    source=ctx.createBufferSource();
    source.buffer=this.getNoiseBuffer();
    const filter=ctx.createBiquadFilter();
    filter.type='lowpass';
    filter.frequency.value=note===42||note===44?8500:note===38||note===40?3200:1800;
    source.connect(filter);filter.connect(voiceGain);
    envelope={attack:0.002,release:note===42||note===44?0.08:0.22};
   }else{
    source=ctx.createOscillator();
    source.type=this.waveform(program,isDrum);
    const frequency=440*Math.pow(2,(note-69)/12);
    source.frequency.setValueAtTime(frequency,at);
    if(isDrum){
     source.type='sine';
     source.frequency.setValueAtTime(145,at);
     source.frequency.exponentialRampToValueAtTime(42,at+0.16);
    }
    const filter=ctx.createBiquadFilter();
    filter.type='lowpass';
    filter.frequency.value=this.filterCutoff(program);
    source.connect(filter);filter.connect(voiceGain);
    envelope=this.envelope(program,isDrum);
   }

   const peak=amp*(isDrum?0.85:1);
   voiceGain.gain.setValueAtTime(0.0001,at);
   voiceGain.gain.linearRampToValueAtTime(Math.max(0.0002,peak),at+envelope.attack);
   source.start(at);
   if(isDrum){
    const end=at+envelope.release;
    voiceGain.gain.setTargetAtTime(0.0001,at+envelope.attack,envelope.release/3);
    source.stop(end+0.03);
    return;
   }
   const key=channel+':'+note;
   const voices=this.activeNotes.get(key)||[];
   voices.push({source,gain:voiceGain,envelope});
   this.activeNotes.set(key,voices);
  }

  noteOff(channel,note,at){
   const key=channel+':'+note;
   const voices=this.activeNotes.get(key);
   if(!voices||!voices.length)return;
   const voice=voices.shift();
   if(!voices.length)this.activeNotes.delete(key);
   const release=Math.max(0.08,voice.envelope.release);
   voice.gain.gain.cancelScheduledValues(at);
   voice.gain.gain.setTargetAtTime(0.0001,at,release/3);
   try{voice.source.stop(at+release+0.04)}catch{}
  }

  waveform(program,isDrum){
   if(isDrum)return 'sine';
   if(program<=7||program>=64&&program<=79||program>=104&&program<=111)return 'triangle';
   if(program>=8&&program<=15)return 'sine';
   if(program>=16&&program<=23)return 'square';
   if(program>=24&&program<=39)return 'triangle';
   if(program>=40&&program<=63)return 'sawtooth';
   if(program>=80&&program<=103)return program%2?'square':'sawtooth';
   return 'triangle';
  }

  filterCutoff(program){
   if(program>=32&&program<=39)return 700;
   if(program>=40&&program<=55)return 2600;
   if(program>=56&&program<=63)return 3200;
   if(program>=80&&program<=103)return 2200;
   return 6000;
  }

  envelope(program,isDrum){
   if(isDrum)return{attack:0.002,release:0.22};
   if(program>=40&&program<=55||program>=88&&program<=95)return{attack:0.12,release:0.32};
   if(program<=7||program>=24&&program<=39)return{attack:0.004,release:0.2};
   return{attack:0.025,release:0.18};
  }

  getNoiseBuffer(){
   if(this.noiseBuffer)return this.noiseBuffer;
   const length=Math.floor(this.context.sampleRate*0.3);
   this.noiseBuffer=this.context.createBuffer(1,length,this.context.sampleRate);
   const data=this.noiseBuffer.getChannelData(0);
   for(let i=0;i<length;i++)data[i]=Math.random()*2-1;
   return this.noiseBuffer;
  }
 }

 function decodeBase64(text){
  const binary=atob(text);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return bytes;
 }

 function parseMidi(bytes){
  let offset=0;
  const text=(start,length)=>String.fromCharCode(...bytes.subarray(start,start+length));
  const u16=()=>{const v=(bytes[offset]<<8)|bytes[offset+1];offset+=2;return v};
  const u32=()=>{const v=(bytes[offset]*0x1000000)+(bytes[offset+1]<<16)+(bytes[offset+2]<<8)+bytes[offset+3];offset+=4;return v};
  const varlen=()=>{let value=0,b;do{b=bytes[offset++];value=(value<<7)|(b&0x7f)}while(b&0x80);return value};

  if(text(offset,4)!=='MThd')throw new Error('Archivo MIDI no válido.');
  offset+=4;
  const headerLength=u32();
  const format=u16();
  const trackCount=u16();
  const division=u16();
  offset+=Math.max(0,headerLength-6);
  if(division&0x8000)throw new Error('División SMPTE no compatible.');
  const ticksPerQuarter=division||480;
  const all=[];
  let order=0;

  for(let track=0;track<trackCount&&offset+8<=bytes.length;track++){
   const id=text(offset,4);offset+=4;
   const length=u32();
   const end=Math.min(bytes.length,offset+length);
   if(id!=='MTrk'){offset=end;continue}
   let tick=0,running=0;
   while(offset<end){
    tick+=varlen();
    let status=bytes[offset];
    if(status<0x80){if(!running)throw new Error('Estado MIDI incompleto.');status=running}else offset++;
    if(status===0xff){
     const meta=bytes[offset++];
     const size=varlen();
     if(meta===0x51&&size===3){const tempo=(bytes[offset]<<16)|(bytes[offset+1]<<8)|bytes[offset+2];all.push({tick,order:order++,kind:'tempo',tempo})}
     offset+=size;
     continue;
    }
    if(status===0xf0||status===0xf7){offset+=varlen();running=0;continue}
    if(status<0xf0)running=status;
    const type=status&0xf0;
    const channel=status&0x0f;
    const a=bytes[offset++];
    const b=(type===0xc0||type===0xd0)?0:bytes[offset++];
    if(type===0x80||type===0x90||type===0xb0||type===0xc0){all.push({tick,order:order++,kind:'channel',type,channel,a,b})}
   }
   offset=end;
  }

  all.sort((a,b)=>{if(a.tick!==b.tick)return a.tick-b.tick;if(a.kind!==b.kind)return a.kind==='tempo'?-1:1;return a.order-b.order});
  let tempo=500000,lastTick=0,seconds=0;
  const events=[];
  for(const item of all){
   seconds+=(item.tick-lastTick)*tempo/(ticksPerQuarter*1000000);
   lastTick=item.tick;
   if(item.kind==='tempo'){tempo=item.tempo;continue}
   events.push({time:seconds,type:item.type,channel:item.channel,a:item.a,b:item.b});
  }
  if(!events.length)throw new Error('El MIDI no contiene notas reproducibles.');
  return{events,duration:events[events.length-1].time+1.2,format};
 }

 window.MidiPlayer=MidiPlayer;
})();
