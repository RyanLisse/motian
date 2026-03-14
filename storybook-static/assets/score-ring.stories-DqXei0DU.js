import{j as s}from"./iframe-kI-p6Njh.js";import"./preload-helper-PPVm8Dsz.js";function g(e){return e>=90?"text-green-500":e>=80?"text-blue-500":e>=70?"text-amber-500":"text-red-500"}function h(e){return e>=90?"stroke-green-500":e>=80?"stroke-blue-500":e>=70?"stroke-amber-500":"stroke-red-500"}function l({score:e,size:r=56,strokeWidth:u=4,className:p=""}){const m=(r-u)/2,d=2*Math.PI*m,f=d-Math.min(100,Math.max(0,e))/100*d;return s.jsxs("div",{className:`relative inline-flex items-center justify-center ${p}`,children:[s.jsxs("svg",{width:r,height:r,className:"-rotate-90","aria-hidden":"true",role:"presentation",children:[s.jsx("circle",{cx:r/2,cy:r/2,r:m,fill:"none",strokeWidth:u,className:"stroke-muted"}),s.jsx("circle",{cx:r/2,cy:r/2,r:m,fill:"none",strokeWidth:u,strokeLinecap:"round",strokeDasharray:d,strokeDashoffset:f,className:`${h(e)} transition-[stroke-dashoffset] duration-700 ease-out`})]}),s.jsx("span",{className:`absolute text-xs font-bold ${g(e)}`,children:Math.round(e)})]})}l.__docgenInfo={description:"",methods:[],displayName:"ScoreRing",props:{score:{required:!0,tsType:{name:"number"},description:""},size:{required:!1,tsType:{name:"number"},description:"",defaultValue:{value:"56",computed:!1}},strokeWidth:{required:!1,tsType:{name:"number"},description:"",defaultValue:{value:"4",computed:!1}},className:{required:!1,tsType:{name:"string"},description:"",defaultValue:{value:'""',computed:!1}}}};const b={title:"Components/ScoreRing",component:l,tags:["autodocs"],parameters:{docs:{description:{component:"Cirkelindicator voor match- of kwaliteitsscore (0–100). Kleur per band: groen ≥90, blauw ≥80, amber ≥70, rood <70. Gebruikt in matching en kandidaatkaarten."}}},argTypes:{score:{control:{type:"range",min:0,max:100,step:5}},size:{control:"number"},strokeWidth:{control:"number"}}},a={args:{score:0}},o={args:{score:50}},t={args:{score:75}},n={args:{score:92}},c={args:{score:100}},i={args:{score:68,size:80,strokeWidth:6}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    score: 0
  }
}`,...a.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    score: 50
  }
}`,...o.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    score: 75
  }
}`,...t.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    score: 92
  }
}`,...n.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    score: 100
  }
}`,...c.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    score: 68,
    size: 80,
    strokeWidth: 6
  }
}`,...i.parameters?.docs?.source}}};const S=["Zero","Half","Good","High","Full","CustomSize"];export{i as CustomSize,c as Full,t as Good,o as Half,n as High,a as Zero,S as __namedExportsOrder,b as default};
