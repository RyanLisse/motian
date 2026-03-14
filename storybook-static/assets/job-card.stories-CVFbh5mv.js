import{j as n}from"./iframe-kI-p6Njh.js";import{L as p}from"./link-CYjKAWmV.js";import{B as a}from"./badge-C1tah0Be.js";import{U as d,B as u,M as g,C as x}from"./users-DwU9_mRH.js";import{c as m}from"./createLucideIcon-BnV1XlTb.js";import"./preload-helper-PPVm8Dsz.js";import"./index-LHNt3CwB.js";import"./utils-BQHNewu7.js";import"./index-fq99SDQe.js";const y=[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}]],h=m("calendar",y);const f=[["path",{d:"M4 10h12",key:"1y6xl8"}],["path",{d:"M4 14h9",key:"1loblj"}],["path",{d:"M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2",key:"1j6lzo"}]],w=m("euro",f);const D=[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]],k=m("triangle-alert",D),M={hybride:"Hybride",op_locatie:"Op locatie",remote:"Remote"};function c({job:e,pipelineCount:o}){const s=e.applicationDeadline&&new Date(e.applicationDeadline).getTime()-Date.now()<2592e5&&new Date(e.applicationDeadline).getTime()>Date.now();return n.jsx(p,{href:`/vacatures/${e.id}`,children:n.jsxs("div",{className:`bg-card border rounded-lg p-4 hover:border-primary/40 hover:bg-accent transition-colors cursor-pointer ${s?"border-orange-400/60":"border-border"}`,children:[n.jsxs("div",{className:"flex items-start justify-between gap-2 mb-3",children:[n.jsx("h3",{className:"text-sm font-semibold text-foreground line-clamp-2 leading-snug",children:e.title}),n.jsxs("div",{className:"flex items-center gap-1.5 shrink-0",children:[o!=null&&o>0&&n.jsxs(a,{variant:"outline",className:"text-[10px] bg-primary/10 text-primary border-primary/20 flex items-center gap-0.5",children:[n.jsx(d,{className:"h-2.5 w-2.5"}),o]}),n.jsx(a,{variant:"outline",className:"text-[10px] capitalize border-border text-muted-foreground bg-transparent",children:e.platform})]})]}),n.jsxs("div",{className:"flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground mb-3",children:[e.company&&n.jsxs("span",{className:"flex items-center gap-1.5",children:[n.jsx(u,{className:"h-3.5 w-3.5"}),e.company]}),e.location&&n.jsxs("span",{className:"flex items-center gap-1.5",children:[n.jsx(g,{className:"h-3.5 w-3.5"}),e.location]}),(e.rateMin||e.rateMax)&&n.jsxs("span",{className:"flex items-center gap-1.5",children:[n.jsx(w,{className:"h-3.5 w-3.5"}),e.rateMin&&e.rateMax?`${e.rateMin} - ${e.rateMax}/uur`:e.rateMax?`max ${e.rateMax}/uur`:`min ${e.rateMin}/uur`]})]}),n.jsxs("div",{className:"flex items-center gap-2 flex-wrap mb-2",children:[e.workArrangement&&n.jsx(a,{variant:"outline",className:e.workArrangement==="remote"?"bg-primary/10 text-primary border-primary/20 text-[10px]":"text-[10px] border-border text-muted-foreground bg-transparent",children:M[e.workArrangement]??e.workArrangement}),e.contractType&&n.jsx(a,{variant:"outline",className:"text-[10px] border-border text-muted-foreground capitalize bg-transparent",children:e.contractType})]}),n.jsxs("div",{className:"flex items-center gap-4 text-xs text-muted-foreground pt-1",children:[e.applicationDeadline&&n.jsxs("span",{className:`flex items-center gap-1 ${s?"text-orange-600 font-medium":""}`,children:[s?n.jsx(k,{className:"h-3 w-3"}):n.jsx(x,{className:"h-3 w-3"}),"Sluit"," ",new Date(e.applicationDeadline).toLocaleDateString("nl-NL",{day:"numeric",month:"short"})]}),e.postedAt&&n.jsxs("span",{className:"flex items-center gap-1",children:[n.jsx(h,{className:"h-3 w-3"}),new Date(e.postedAt).toLocaleDateString("nl-NL",{day:"numeric",month:"short"})]})]})]})})}c.__docgenInfo={description:"",methods:[],displayName:"JobCard",props:{job:{required:!0,tsType:{name:"signature",type:"object",raw:`{
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  platform: string;
  contractType: string | null;
  workArrangement: string | null;
  rateMin: number | null;
  rateMax: number | null;
  applicationDeadline: Date | null;
  postedAt: Date | null;
}`,signature:{properties:[{key:"id",value:{name:"string",required:!0}},{key:"title",value:{name:"string",required:!0}},{key:"company",value:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}],required:!0}},{key:"location",value:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}],required:!0}},{key:"platform",value:{name:"string",required:!0}},{key:"contractType",value:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}],required:!0}},{key:"workArrangement",value:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}],required:!0}},{key:"rateMin",value:{name:"union",raw:"number | null",elements:[{name:"number"},{name:"null"}],required:!0}},{key:"rateMax",value:{name:"union",raw:"number | null",elements:[{name:"number"},{name:"null"}],required:!0}},{key:"applicationDeadline",value:{name:"union",raw:"Date | null",elements:[{name:"Date"},{name:"null"}],required:!0}},{key:"postedAt",value:{name:"union",raw:"Date | null",elements:[{name:"Date"},{name:"null"}],required:!0}}]}},description:""},pipelineCount:{required:!1,tsType:{name:"number"},description:"Number of candidates in pipeline for this job"}}};const S={title:"Components/JobCard",component:c,tags:["autodocs"],argTypes:{"job.platform":{control:"text"},"job.workArrangement":{control:"select",options:["on-site","hybride","remote",null]},"job.contractType":{control:"select",options:["freelance","interim","vast",null]}},parameters:{docs:{description:{component:"Kaart voor een vacature met bedrijf, locatie, tarief en deadline."}}}},t={args:{job:{id:"1",title:"Senior React Developer — Cloud Platform",company:"ING Bank",location:"Amsterdam",platform:"striive",contractType:"freelance",workArrangement:"hybride",rateMin:85,rateMax:110,applicationDeadline:new Date("2026-03-15"),postedAt:new Date("2026-02-20")}}},r={args:{job:{id:"2",title:"Java Backend Engineer",company:null,location:null,platform:"huxley",contractType:null,workArrangement:null,rateMin:null,rateMax:null,applicationDeadline:null,postedAt:new Date("2026-02-18")}}},i={args:{job:{id:"3",title:"DevOps Engineer — Kubernetes & Terraform",company:"Rabobank",location:"Utrecht",platform:"computer-futures",contractType:"interim",workArrangement:"remote",rateMin:null,rateMax:95,applicationDeadline:new Date("2026-04-01"),postedAt:new Date("2026-02-22")}}},l={args:{job:{id:"4",title:"Senior Data Engineer — Azure & Databricks",company:"ABN AMRO",location:"Amsterdam",platform:"striive",contractType:"freelance",workArrangement:"hybride",rateMin:90,rateMax:120,applicationDeadline:new Date("2026-03-20"),postedAt:new Date("2026-02-25")},pipelineCount:5}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    job: {
      id: "1",
      title: "Senior React Developer — Cloud Platform",
      company: "ING Bank",
      location: "Amsterdam",
      platform: "striive",
      contractType: "freelance",
      workArrangement: "hybride",
      rateMin: 85,
      rateMax: 110,
      applicationDeadline: new Date("2026-03-15"),
      postedAt: new Date("2026-02-20")
    }
  }
}`,...t.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    job: {
      id: "2",
      title: "Java Backend Engineer",
      company: null,
      location: null,
      platform: "huxley",
      contractType: null,
      workArrangement: null,
      rateMin: null,
      rateMax: null,
      applicationDeadline: null,
      postedAt: new Date("2026-02-18")
    }
  }
}`,...r.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    job: {
      id: "3",
      title: "DevOps Engineer — Kubernetes & Terraform",
      company: "Rabobank",
      location: "Utrecht",
      platform: "computer-futures",
      contractType: "interim",
      workArrangement: "remote",
      rateMin: null,
      rateMax: 95,
      applicationDeadline: new Date("2026-04-01"),
      postedAt: new Date("2026-02-22")
    }
  }
}`,...i.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    job: {
      id: "4",
      title: "Senior Data Engineer — Azure & Databricks",
      company: "ABN AMRO",
      location: "Amsterdam",
      platform: "striive",
      contractType: "freelance",
      workArrangement: "hybride",
      rateMin: 90,
      rateMax: 120,
      applicationDeadline: new Date("2026-03-20"),
      postedAt: new Date("2026-02-25")
    },
    pipelineCount: 5
  }
}`,...l.parameters?.docs?.source}}};const _=["FullData","MinimalData","RemoteBadge","WithPipelineCount"];export{t as FullData,r as MinimalData,i as RemoteBadge,l as WithPipelineCount,_ as __namedExportsOrder,S as default};
