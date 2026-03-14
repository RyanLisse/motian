import{j as u}from"./iframe-kI-p6Njh.js";import{L as v}from"./link-CYjKAWmV.js";import"./preload-helper-PPVm8Dsz.js";const f={active:"bg-primary text-primary-foreground",inactive:"bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent"},g={active:"bg-primary/10 text-primary font-medium",inactive:"text-muted-foreground hover:text-foreground hover:bg-accent"};function c({options:n,activeValue:p,buildHref:d,variant:o="pill",icon:m}){const i=o==="pill"?f:g,b=o==="pill"?"h-8 px-3 flex items-center rounded-lg text-sm transition-colors":"px-3 py-1.5 rounded-md text-sm transition-colors";return u.jsxs("div",{className:"flex items-center gap-2 flex-wrap",children:[m,n.map(e=>u.jsx(v,{href:d(e.value),className:`${b} ${p===e.value?i.active:i.inactive}`,children:e.label},e.value))]})}c.__docgenInfo={description:"",methods:[],displayName:"FilterTabs",props:{options:{required:!0,tsType:{name:"Array",elements:[{name:"FilterOption"}],raw:"FilterOption[]"},description:""},activeValue:{required:!0,tsType:{name:"string"},description:""},buildHref:{required:!0,tsType:{name:"signature",type:"function",raw:"(value: string) => string",signature:{arguments:[{type:{name:"string"},name:"value"}],return:{name:"string"}}},description:"Build the href for a given filter value"},variant:{required:!1,tsType:{name:"union",raw:'"pill" | "subtle"',elements:[{name:"literal",value:'"pill"'},{name:"literal",value:'"subtle"'}]},description:'"pill" = solid active bg (default), "subtle" = translucent active bg',defaultValue:{value:'"pill"',computed:!1}},icon:{required:!1,tsType:{name:"ReactNode"},description:"Optional icon rendered before the tabs"}}};const s=[{value:"all",label:"Alle"},{value:"open",label:"Open"},{value:"closed",label:"Gesloten"}],O={title:"Components/FilterTabs",component:c,tags:["autodocs"],parameters:{docs:{description:{component:"Tabbladen voor filterkeuze (bijv. open/gesloten). Link-gebaseerd met buildHref. Varianten: pill (solid) en subtle."}}},argTypes:{activeValue:{control:"select",options:["all","open","closed"]},variant:{control:"select",options:["pill","subtle"]}}};function l(n){return`/vacatures?status=${n}`}const t={args:{options:s,activeValue:"all",buildHref:l}},r={args:{options:s,activeValue:"open",buildHref:l}},a={args:{options:s,activeValue:"closed",buildHref:l,variant:"subtle"}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    options: defaultOptions,
    activeValue: "all",
    buildHref
  }
}`,...t.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    options: defaultOptions,
    activeValue: "open",
    buildHref
  }
}`,...r.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    options: defaultOptions,
    activeValue: "closed",
    buildHref,
    variant: "subtle"
  }
}`,...a.parameters?.docs?.source}}};const T=["Default","OneSelected","Subtle"];export{t as Default,r as OneSelected,a as Subtle,T as __namedExportsOrder,O as default};
