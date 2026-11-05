// Uncompressed ZIP, UTF-8 paths, CRC32. No external CDN or runtime dependency.
const encoder=new TextEncoder();
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export function zipBytes(files){
  const parts=[],directory=[];let offset=0;
  const header=size=>{const bytes=new Uint8Array(size);return [bytes,new DataView(bytes.buffer)];};
  for(const file of files){const name=encoder.encode(file.filename),data=file.content instanceof Uint8Array?file.content:encoder.encode(file.content),crc=crc32(data),[local,l]=header(30),[central,c]=header(46);
    l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,name.length,true);
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);
    parts.push(local,name,data);directory.push(central,name);offset+=local.length+name.length+data.length;
  }
  const size=directory.reduce((n,b)=>n+b.length,0),[end,e]=header(22);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
  const out=new Uint8Array(offset+size+22);let i=0;for(const part of [...parts,...directory,end]){out.set(part,i);i+=part.length;}return out;
}
export function downloadZip(name,files){const url=URL.createObjectURL(new Blob([zipBytes(files)],{type:'application/zip'})),a=Object.assign(document.createElement('a'),{href:url,download:name});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
