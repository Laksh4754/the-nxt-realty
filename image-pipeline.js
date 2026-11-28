(() => {
  const MAX_BYTES = 10 * 1024 * 1024;
  const IMAGE_TYPES = new Set(['image/jpeg','image/png','image/webp','image/avif']);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  function canvasBlob(canvas, type, quality) { return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(`This browser could not encode ${type}.`)), type, quality)); }
  function loadBitmap(file) { return createImageBitmap(file).catch(() => { throw new Error(`${file.name} could not be decoded. The file may be corrupt or mislabeled.`); }); }
  function drawScaled(bitmap, width, height, fill = false) {
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(width)); canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext('2d', {alpha:true}); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (fill) { const scale = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height); const w = bitmap.width * scale, h = bitmap.height * scale; ctx.drawImage(bitmap, (canvas.width-w)/2, (canvas.height-h)/2, w, h); }
    else { ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); }
    return canvas;
  }
  function makeFloorPlanPreview(bitmap) {
    const scale = Math.min(320 / bitmap.width, 200 / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const bleed = 48;
    const padded = document.createElement('canvas'); padded.width = width + bleed * 2; padded.height = height + bleed * 2;
    const paddedContext = padded.getContext('2d'); paddedContext.fillStyle = '#e8e3d8'; paddedContext.fillRect(0, 0, padded.width, padded.height);
    paddedContext.drawImage(bitmap, bleed, bleed, width, height);
    const blurred = document.createElement('canvas'); blurred.width = padded.width; blurred.height = padded.height;
    const blurContext = blurred.getContext('2d'); blurContext.filter = 'blur(24px)'; blurContext.drawImage(padded, 0, 0); blurContext.filter = 'none';
    const preview = document.createElement('canvas'); preview.width = width; preview.height = height;
    preview.getContext('2d').drawImage(blurred, bleed, bleed, width, height, 0, 0, width, height);
    return preview;
  }
  async function inspectPixels(bitmap) {
    const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = drawScaled(bitmap, w, h), ctx = canvas.getContext('2d', {willReadFrequently:true}), pixels = ctx.getImageData(0,0,w,h).data;
    const gray = (x,y) => { const i=(y*w+x)*4, a=pixels[i+3]/255; return {v:(pixels[i]*.299+pixels[i+1]*.587+pixels[i+2]*.114)*a+255*(1-a),a}; };
    let mean=0, count=0, bounds={x0:w,y0:h,x1:-1,y1:-1};
    for(let y=0;y<h;y+=2) for(let x=0;x<w;x+=2){ const p=gray(x,y); if(p.a>.08 && p.v<244){bounds.x0=Math.min(bounds.x0,x);bounds.y0=Math.min(bounds.y0,y);bounds.x1=Math.max(bounds.x1,x);bounds.y1=Math.max(bounds.y1,y);} }
    for(let y=1;y<h-1;y+=2) for(let x=1;x<w-1;x+=2){ const lap=gray(x-1,y).v+gray(x+1,y).v+gray(x,y-1).v+gray(x,y+1).v-4*gray(x,y).v; mean+=lap*lap; count++; }
    const sharpness=count?mean/count:0, cropBounds=bounds.x1>=bounds.x0?bounds:{x0:0,y0:0,x1:w-1,y1:h-1};
    const margins={left:cropBounds.x0/w,top:cropBounds.y0/h,right:(w-1-cropBounds.x1)/w,bottom:(h-1-cropBounds.y1)/h};
    return {sharpness,margins, crop:{x:cropBounds.x0/scale,y:cropBounds.y0/scale,width:(cropBounds.x1-cropBounds.x0+1)/scale,height:(cropBounds.y1-cropBounds.y0+1)/scale}, alpha: (()=>{for(let i=3;i<pixels.length;i+=4)if(pixels[i]<250)return true;return false;})()};
  }
  async function encode(canvas, quality=.86) {
    const blob=await canvasBlob(canvas,'image/webp',quality); return {blob,ext:blob.type==='image/webp'?'webp':'png',type:blob.type};
  }
  const pretty = n => n >= 1048576 ? `${(n/1048576).toFixed(1)} MB` : `${Math.max(1,Math.round(n/1024))} KB`;
  async function stage(file, kind) {
    if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 10 MB.`);
    if (file.type === 'application/pdf') {
      const signature=new TextDecoder().decode(await file.slice(0,5).arrayBuffer()); if(signature!=='%PDF-')throw new Error(`${file.name} does not have a valid PDF header.`);
      if (kind !== 'floor-plan') throw new Error('PDF files are only accepted for floor plans.');
      return {file,kind,pdf:true,primary:file,variants:[],thumbnail:null,metrics:{format:'PDF',bytes:file.size},crop:null};
    }
    if (!IMAGE_TYPES.has(file.type)) throw new Error(`${file.name} is not a supported JPG, PNG, WebP or AVIF image.`);
    const bitmap=await loadBitmap(file);
    try {
      const width=bitmap.width,height=bitmap.height, pixels=await inspectPixels(bitmap), ratio=width/height;
      const warnings=[];
      if(kind==='logo' ? (width<300 || height<200) : (width<900 || height<600)) warnings.push(kind==='logo'?'Low resolution for a displayed logo.':'Low resolution for a large listing image.');
      if(pixels.sharpness<36) warnings.push('Image may be soft or out of focus; compare the preview before using it.');
      if(kind==='logo' && Math.max(pixels.margins.left,pixels.margins.right,pixels.margins.top,pixels.margins.bottom)>.16) warnings.push('Large edge margins detected. A whitespace-trim preview is available; trimming is optional.');
      if(kind!=='floor-plan' && (ratio<.52 || ratio>2.5)) warnings.push('Unusual aspect ratio. The full image will be kept without a forced crop.');
      const floorPlan=kind==='floor-plan';
      const maxSide=floorPlan?320:1600, scale=Math.min(1,maxSide/Math.max(width,height));
      const base=drawScaled(bitmap,width*scale,height*scale), thumbScale=Math.min(320/width,200/height), thumb=floorPlan?makeFloorPlanPreview(bitmap):drawScaled(bitmap,width*thumbScale,height*thumbScale);
      const candidatePrimary=floorPlan?{blob:file,ext:(file.name.split('.').pop()||'bin').toLowerCase(),type:file.type}:await encode(base,.88); const encodedPrimary=!floorPlan && scale===1 && candidatePrimary.blob.size>=file.size?{blob:file,ext:(file.name.split('.').pop()||'jpg').toLowerCase(),type:file.type}:candidatePrimary; const primary=encodedPrimary.blob;
      const variants=[];
      if(!floorPlan) for(const target of [320,480,640,960]) if(Math.max(width,height)>target){const sc=target/Math.max(width,height), rendition=drawScaled(bitmap,width*sc,height*sc), encoded=await encode(rendition,.84); variants.push({width:Math.round(width*sc),blob:encoded.blob,type:encoded.type,ext:encoded.ext});}
      const encodedThumb=await encode(thumb,.78), thumbnail=encodedThumb.blob;
      let crop=null;
      if(kind==='logo' && warnings.some(x=>x.startsWith('Large edge margins'))){
        const b=pixels.crop, cropCanvas=document.createElement('canvas'); cropCanvas.width=Math.round(b.width);cropCanvas.height=Math.round(b.height);cropCanvas.getContext('2d').drawImage(bitmap,b.x,b.y,b.width,b.height,0,0,cropCanvas.width,cropCanvas.height);
        const encodedCrop=await encode(cropCanvas,.9); crop={blob:encodedCrop.blob,type:encodedCrop.type,ext:encodedCrop.ext,width:Math.round(b.width),height:Math.round(b.height),previewUrl:URL.createObjectURL(encodedCrop.blob)};
      }
      return {file,kind,pdf:false,primary,primaryWidth:floorPlan?width:Math.round(width*scale),primaryHeight:floorPlan?height:Math.round(height*scale),variants,thumbnail,metrics:{width,height,ratio,sharpness:pixels.sharpness,margins:pixels.margins,format:file.type,outputFormat:encodedPrimary.type,outputExt:encodedPrimary.ext,outputWidth:floorPlan?width:Math.round(width*scale),outputHeight:floorPlan?height:Math.round(height*scale),thumbFormat:encodedThumb.type,thumbExt:encodedThumb.ext,bytes:file.size,optimizedBytes:primary.size,alpha:pixels.alpha},warnings,crop,originalUrl:URL.createObjectURL(file),afterUrl:URL.createObjectURL(primary)};
    } finally { bitmap.close?.(); }
  }
  function init(form) {
    const section=document.querySelector('#mediaReview'), host=section?.querySelector('.media-review-list')||section, staged=new WeakMap(), records=new Map();
    let sequence=0;
    const inputs=()=>[...form.querySelectorAll('input[type=file][data-media-kind]')];
    const revoke=x=>{if(!x)return;[x.originalUrl,x.afterUrl,x.crop?.previewUrl].forEach(u=>u&&URL.revokeObjectURL(u));};
    const refreshSave=()=>{const save=form.querySelector('[type=submit]'); if(save){const pending=[...records.values()].some(r=>!r.busy&&!r.approved||r.busy);save.dataset.mediaReady=pending?'false':'true';}};
    const renderRecord=(file,kind,token)=>{
      const card=document.createElement('article');card.className='media-review-card';card.dataset.token=token;
      const title=document.createElement('strong');title.textContent=file.name;
      const status=document.createElement('span');status.className='media-review-status';status.textContent='Inspecting file…';
      card.append(title,status);host.append(card);return card;
    };
    async function inspectInput(input){
      const files=[...input.files||[]];
      for(const [file,record] of records) if(record.input===input&&!files.includes(file)){revoke(record.asset);record.card.remove();records.delete(file);}
      for(const file of files){
        if(records.has(file))continue;
        const kind=input.dataset.mediaKind||'photo',token=String(++sequence),card=renderRecord(file,kind,token),record={input,card,busy:true,approved:false,asset:null};records.set(file,record);refreshSave();
        try{
          const asset=await stage(file,kind);record.asset=asset;record.busy=false;staged.set(file,asset);card.replaceChildren();
          const heading=document.createElement('div');heading.className='media-review-heading';const name=document.createElement('strong');name.textContent=file.name;const status=document.createElement('span');status.className='media-review-status';status.textContent=asset.pdf?'PDF preserved':'Review before saving';heading.append(name,status);card.append(heading);
          const metrics=document.createElement('p');metrics.className='media-review-metrics';metrics.textContent=asset.pdf?`PDF · ${pretty(file.size)} · original document will be kept`: `${asset.metrics.width} × ${asset.metrics.height} px · ratio ${asset.metrics.ratio.toFixed(2)}:1 · sharpness estimate ${asset.metrics.sharpness.toFixed(0)} · margins L ${Math.round(asset.metrics.margins.left*100)}% / T ${Math.round(asset.metrics.margins.top*100)}% / R ${Math.round(asset.metrics.margins.right*100)}% / B ${Math.round(asset.metrics.margins.bottom*100)}% · ${asset.metrics.format.replace('image/','').toUpperCase()} → ${asset.metrics.outputFormat.replace('image/','').toUpperCase()} · ${pretty(file.size)} → ${pretty(asset.primary.size)} · ${asset.metrics.alpha?'transparency preserved':'opaque image'}`;card.append(metrics);
          if(asset.warnings?.length){const ul=document.createElement('ul');ul.className='media-review-warnings';asset.warnings.forEach(w=>{const li=document.createElement('li');li.textContent=w;ul.append(li);});card.append(ul);}
          if(!asset.pdf){const previews=document.createElement('div');previews.className='media-review-previews';for(const [label,url] of [['Before',asset.originalUrl],['After · full image',asset.afterUrl]]){const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');img.src=url;img.alt=`${label} preview of ${file.name}`;caption.textContent=label;figure.append(img,caption);previews.append(figure);}card.append(previews);}
          if(asset.crop){const crop=document.createElement('label');crop.className='media-crop-choice';const check=document.createElement('input');check.type='checkbox';check.addEventListener('change',()=>{asset.useCrop=check.checked;});const text=document.createElement('span');text.textContent='Use optional whitespace-trimmed logo preview';const image=document.createElement('img');image.src=asset.crop.previewUrl;image.alt=`Optional whitespace-trim preview of ${file.name}`;crop.append(check,text,image);card.append(crop);}
          const approve=document.createElement('button');approve.type='button';approve.className='secondary media-approve';approve.textContent='Approve this image';approve.addEventListener('click',()=>{record.approved=!record.approved;approve.textContent=record.approved?'Approved · click to undo':'Approve this image';approve.setAttribute('aria-pressed',String(record.approved));status.textContent=record.approved?'Ready to save':'Review before saving';record.card.classList.toggle('is-approved',record.approved);refreshSave();});card.append(approve);
        }catch(error){record.busy=false;record.error=error;card.classList.add('has-error');card.querySelector('.media-review-status').textContent=error.message;}
        refreshSave();
      }
    }
    form.addEventListener('change',e=>{if(e.target.matches('input[type=file][data-media-kind]')) inspectInput(e.target);});
    form.addEventListener('click',e=>{if(e.target.matches('#addConfigurationBtn,#addLifestyleHighlightBtn'))setTimeout(()=>inputs().forEach(inspectInput),0);});
    form.addEventListener('submit',e=>{if(!assertApproved(form)){e.preventDefault();e.stopImmediatePropagation();section.scrollIntoView({behavior:'smooth',block:'center'});section.focus?.();}},true);
    form.querySelectorAll('input[type=file][data-media-kind]').forEach(inspectInput);
    return {
      assetFor:file=>staged.get(file),
      clear(){for(const r of records.values())revoke(r.asset);records.clear();host.innerHTML='';sayMedia('');refreshSave();},
      assertApproved:()=>assertApproved(form),
      async waitForProcessing(){while([...records.values()].some(r=>r.busy))await new Promise(r=>setTimeout(r,30));},
      registerAsset:asset=>asset
    };
    function assertApproved(){
      const current=inputs().flatMap(input=>[...input.files||[]]);
      const missing=current.filter(file=>{const r=records.get(file);return !r||r.busy||r.error||!r.approved;});
      if(missing.length){sayMedia(`Review and approve ${missing.length} selected file${missing.length===1?'':'s'} before saving. Corrupt or unsupported files must be replaced.`);return false;}
      sayMedia('');return true;
    }
    function sayMedia(message){const note=document.querySelector('#mediaReviewMessage');if(note)note.textContent=message;}
  }
  window.NXTImagePipeline={stage,pretty,init};
})();
