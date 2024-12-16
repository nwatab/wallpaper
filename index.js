!function(){"use strict";class t{constructor(t=1,e=0,r=0,n=1,s=0,i=0){this.elements=[t,e,r,n,s,i]}static identity(){return new t}static translation(e,r){return new t(1,0,0,1,e,r)}static scaling(e,r){return new t(e,0,0,r,0,0)}static rotation(e){const r=Math.cos(e),n=Math.sin(e);return new t(r,n,-n,r,0,0)}static shear(e,r){return new t(1,e,r,1,0,0)}multiply(e){const[r,n,s,i,o,a]=this.elements,[h,c,l,d,u,p]=e.elements;return new t(r*h+s*c,n*h+i*c,r*l+s*d,n*l+i*d,r*u+s*p+o,n*u+i*p+a)}applyToPoint(t){const[e,r,n,s,i,o]=this.elements,[a,h]=t;return[e*a+n*h+i,r*a+s*h+o]}applyToVector(t){const[e,r,n,s]=this.elements,[i,o]=t;return[e*i+n*o,r*i+s*o]}inverse(){const[e,r,n,s,i,o]=this.elements,a=e*s-r*n;if(0===a)return null;return new t(s/a,-r/a,-n/a,e/a,(n*o-s*i)/a,(r*i-e*o)/a)}isIdentity(){const[t,e,r,n,s,i]=this.elements;return 1===t&&0===e&&0===r&&1===n&&0===s&&0===i}getElements(){const[t,e,r,n,s,i]=this.elements;return{a11:t,a21:e,a12:r,a22:n,a13:s,a23:i}}toJSON(){return this.elements}}class e{constructor(e){this.transformMatrix=e??t.identity()}transform(t){const e=this.transformMatrix.multiply(t.getMatrix()),r=this.clone();return r.transformMatrix=e,r}}class r extends e{constructor(e,r,n,s,i,o=t.identity()){super(),this.x=e,this.y=r,this.width=n,this.height=s,this.fill=i,this.transformMatrix=o}transform(t){const e=t.getMatrix().multiply(this.transformMatrix);return new r(this.x,this.y,this.width,this.height,this.fill,e)}clone(){return new r(this.x,this.y,this.width,this.height,this.fill,this.transformMatrix)}}class n extends e{constructor(t,e,r,n,s){super(s),this.cx=t,this.cy=e,this.r=r,this.fill=n}clone(){return new n(this.cx,this.cy,this.r,this.fill,this.transformMatrix)}}class s{constructor(t){this.shapes=t}applyTransformation(t){const e=this.shapes.map((e=>e.transform(t)));return new this.constructor(e)}}class i{constructor(t,e){this.x=t,this.y=e}add(t){return new i(this.x+t.x,this.y+t.y)}scale(t){return new i(this.x*t,this.y*t)}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}normalize(){const t=this.length();return 0===t?null:new i(this.x/t,this.y/t)}dot(t){return this.x*t.x+this.y*t.y}angle(t){return 0===this.length()||0===t.length()?null:Math.acos(this.dot(t)/(this.length()*t.length()))}getElements(){return[this.x,this.y]}projectToX(){return this.x}projectToY(){return this.y}}class o extends s{constructor(t,e){super(e),this.sideLength=t}getIndependentVectors(){return[new i(this.sideLength,0),new i(0,this.sideLength)]}}class a extends s{constructor(t,e,r){super([]),this.width=t,this.height=e}getIndependentVectors(){return[new i(this.width,0),new i(0,this.height)]}}const h=new o(1,[new r(.1,.1,.3,.3,"red"),new r(.4,.5,.4,.4,"green"),new n(.6,.6,.2,"blue")]);class c{constructor(t){this.groupType=t}}class l extends c{constructor(){super("p1")}generateTransformations(){return[]}computeTileVectors(t){return t.getIndependentVectors()}createFundamentalRegion(t){if(t instanceof a)return{motifs:[t],tileVectors:[new i(t.width,0),new i(0,t.height)],regionType:"Rectangle"};if(t instanceof o)return{motifs:[t],tileVectors:[new i(t.sideLength,0),new i(0,t.sideLength)],regionType:"Square"};throw new Error(`Unknown motif: ${t}`)}}const d={selectedMotif:h,selectedWallpaperGroup:new l,listeners:[]};function u(t){void 0!==t.selectedMotif&&(d.selectedMotif=t.selectedMotif),void 0!==t.selectedWallpaperGroup&&(d.selectedWallpaperGroup=t.selectedWallpaperGroup),d.listeners.forEach((t=>t()))}class p{constructor(t){this.svgContainer=t}setTileSize(t){this.svgContainer.setAttribute("viewBox","0 0 1 1"),this.svgContainer.setAttribute("width",`${t}px`),this.svgContainer.setAttribute("height",`${t}px`),this.svgContainer.setAttribute("preserveAspectRatio","xMidYMid meet")}renderMotif(t){t.shapes.forEach((t=>{const e=this.renderShape(t);this.svgContainer.appendChild(e)}))}renderFundamentalRegion(t){const e=this.createGroupFromFundamentalRegion(t);this.svgContainer.appendChild(e)}renderTilesWithDefs(t,e,r="fundamental-region"){const n=this.getOrCreateDefsElement(),s=n.querySelector(`#${r}`);s&&n.removeChild(s);const i=this.createGroupFromFundamentalRegion(t);i.setAttribute("id",r),n.appendChild(i),e.forEach((t=>{const e=document.createElementNS("http://www.w3.org/2000/svg","use");e.setAttributeNS("http://www.w3.org/1999/xlink","href",`#${r}`);const n=`translate(${t.x}, ${t.y}) scale(64)`;e.setAttribute("transform",n),this.svgContainer.appendChild(e)}))}createGroupFromFundamentalRegion(t){const e=document.createElementNS("http://www.w3.org/2000/svg","g");return t.motifs.forEach((t=>{t.shapes.forEach((t=>{const r=this.renderShape(t);e.appendChild(r)}))})),e}renderRectangle(t){const e=document.createElementNS("http://www.w3.org/2000/svg","rect");if(e.setAttribute("x",t.x.toString()),e.setAttribute("y",t.y.toString()),e.setAttribute("width",t.width.toString()),e.setAttribute("height",t.height.toString()),e.setAttribute("fill",t.fill),!t.transformMatrix.isIdentity()){const r=this.matrixToTransformAttribute(t.transformMatrix);e.setAttribute("transform",r)}return e}renderShape(t){if(t instanceof r)return this.renderRectangle(t);if(t instanceof n)return this.renderCircle(t);throw new Error("Unsupported shape type")}renderCircle(t){const e=document.createElementNS("http://www.w3.org/2000/svg","circle");if(e.setAttribute("cx",t.cx.toString()),e.setAttribute("cy",t.cy.toString()),e.setAttribute("r",t.r.toString()),e.setAttribute("fill",t.fill),!t.transformMatrix.isIdentity()){const r=this.matrixToTransformAttribute(t.transformMatrix);e.setAttribute("transform",r)}return e}matrixToTransformAttribute(t){const{a11:e,a21:r,a12:n,a22:s,a13:i,a23:o}=t.getElements();return`matrix(${e}, ${r}, ${n}, ${s}, ${i}, ${o})`}getOrCreateDefsElement(){let t=this.svgContainer.querySelector("defs");return t||(t=document.createElementNS("http://www.w3.org/2000/svg","defs"),this.svgContainer.prepend(t)),t}clear(){for(;this.svgContainer.firstChild;)this.svgContainer.removeChild(this.svgContainer.firstChild)}}class w{constructor(t){this.motifs=[h],this.container=document.getElementById(t),this.render(),this.setupEventHandlers()}render(){this.container.innerHTML=this.motifs.map(((t,e)=>`\n        <div class="motif-preview" data-motif-index="${e}">\n          ${this.renderMotifPreview(t).outerHTML}\n        </div>\n      `)).join("")}renderMotifPreview(t){const e=document.createElementNS("http://www.w3.org/2000/svg","svg");e.setAttribute("viewBox","0 0 1 1");const r=new p(e);return new m(r).render(t),e}setupEventHandlers(){this.container.querySelectorAll(".motif-preview").forEach((t=>{t.addEventListener("click",(()=>{const e=t.getAttribute("data-motif-index");u({selectedMotif:this.motifs[parseInt(e)]})}))}))}}class m{constructor(t){this.renderer=t}render(t){this.renderer.renderMotif(t)}}class g{constructor(t){this.groups=[{name:"p1",instance:new l}],this.container=document.getElementById(t),this.render(),this.setupEventHandlers()}render(){this.container.innerHTML=this.groups.map((({instance:t,name:e},r)=>`\n        <div class="group-preview" data-group-index="${e}">\n          ${this.renderGroupPreview(t).outerHTML}\n        </div>\n      `)).join("")}renderGroupPreview(t){const e=document.createElementNS("http://www.w3.org/2000/svg","svg");e.setAttribute("viewBox","0 0 1 1");const r=new p(e),n=new f(r),s=t.createFundamentalRegion(d.selectedMotif);return n.render(s),e}setupEventHandlers(){this.container.querySelectorAll(".group-item").forEach((t=>{t.addEventListener("click",(()=>{const e=t.getAttribute("data-group-index");u({selectedWallpaperGroup:this.groups.find((t=>t.name===e)).instance})}))}))}}class f{constructor(t){this.renderer=t}render(t){this.renderer.renderFundamentalRegion(t)}}class v{constructor(t,e){this.width=t,this.height=e}generateWallpaperMotif(t,e){const r=[],n=Math.ceil(this.width/Math.abs(t.add(e).projectToX())),s=Math.ceil(this.height/Math.abs(t.add(e).projectToY()));for(let i=-1;i<=n;i++)for(let n=-1;n<=s;n++){const s=t.scale(i).add(e.scale(n));r.push(s)}return r}}class x{constructor(t){const e=document.querySelector(`#${t}`);if(!e)throw new Error(`SVG element with id ${t} not found.`);var r;this.container=e,this.renderer=new p(this.container),r=()=>this.render(),d.listeners.push(r),window.addEventListener("resize",(()=>this.onWindowResize()))}onWindowResize(){void 0!==this.resizeTimeout&&clearTimeout(this.resizeTimeout),this.resizeTimeout=window.setTimeout((()=>{this.render(),this.resizeTimeout=void 0}),350)}render(){const{selectedMotif:t,selectedWallpaperGroup:e}=d;if(!t||!e)return void(this.container.innerHTML="<p>Please select a motif and a wallpaper group.</p>");e.computeTileVectors(t);const r=e.createFundamentalRegion(t),n=new v(window.innerWidth,window.innerHeight),[s,i]=r.tileVectors.map((t=>t.scale(64))),o=n.generateWallpaperMotif(s,i);this.renderer.clear(),this.renderer.renderTilesWithDefs(r,o)}}window.onload=()=>{new w("motif-gallery"),new g("wallpaper-group-gallery"),new x("wallpaper-view"),u({selectedMotif:h,selectedWallpaperGroup:new l})}}();
//# sourceMappingURL=index.js.map
