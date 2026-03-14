import{j as e}from"./iframe-kI-p6Njh.js";import{L as h}from"./link-CYjKAWmV.js";import{c as v}from"./createLucideIcon-BnV1XlTb.js";import"./preload-helper-PPVm8Dsz.js";const b=[["path",{d:"M3 3v16a2 2 0 0 0 2 2h16",key:"c24i48"}],["path",{d:"M18 17V9",key:"2bz60n"}],["path",{d:"M13 17V5",key:"1frdt8"}],["path",{d:"M8 17v-3",key:"17ska0"}]],o=v("chart-column",b);function i({icon:d,label:u,value:m,valueClassName:p="text-foreground",iconClassName:g="text-muted-foreground",labelClassName:f="text-muted-foreground",compact:l=!1,title:x,href:n}){const c=e.jsxs("div",{className:`bg-card border border-border min-w-0 ${l?"rounded-lg p-3":"rounded-xl p-4"} ${n?"hover:border-primary/40 hover:bg-accent transition-colors cursor-pointer":""}`,title:x,children:[e.jsxs("div",{className:`flex items-center gap-2 min-w-0 ${g} mb-1`,children:[d,e.jsx("span",{className:`text-xs truncate ${f}`,children:u})]}),e.jsx("p",{className:`font-bold truncate ${l?"text-lg":"text-2xl"} ${p}`,children:m})]});return n?e.jsx(h,{href:n,children:c}):c}i.__docgenInfo={description:"",methods:[],displayName:"KPICard",props:{icon:{required:!0,tsType:{name:"ReactNode"},description:""},label:{required:!0,tsType:{name:"string"},description:""},value:{required:!0,tsType:{name:"union",raw:"number | string",elements:[{name:"number"},{name:"string"}]},description:""},valueClassName:{required:!1,tsType:{name:"string"},description:"Tailwind color class for the value text",defaultValue:{value:'"text-foreground"',computed:!1}},iconClassName:{required:!1,tsType:{name:"string"},description:"Tailwind color class for the icon",defaultValue:{value:'"text-muted-foreground"',computed:!1}},labelClassName:{required:!1,tsType:{name:"string"},description:"Tailwind color class for the label text",defaultValue:{value:'"text-muted-foreground"',computed:!1}},compact:{required:!1,tsType:{name:"boolean"},description:"Compact mode uses smaller padding and font size",defaultValue:{value:"false",computed:!1}},title:{required:!1,tsType:{name:"string"},description:"Optional tooltip describing how the value is calculated"},href:{required:!1,tsType:{name:"string"},description:"Optional link — makes the card clickable"}}};const k={title:"Components/KPICard",component:i,tags:["autodocs"],parameters:{docs:{description:{component:"KPI-kaart voor dashboards: icoon, label en waarde. Optioneel compact, tooltip en link. Gebruikt op overzicht en scraper-pagina's."}}},argTypes:{label:{control:"text"},value:{control:"text"},compact:{control:"boolean"},title:{control:"text"}}},a={args:{icon:e.jsx(o,{className:"size-4"}),label:"Actieve vacatures",value:42}},r={args:{icon:e.jsx(o,{className:"size-4"}),label:"Nieuwe deze week",value:"12",valueClassName:"text-green-600"}},t={args:{icon:e.jsx(o,{className:"size-3"}),label:"Matches",value:8,compact:!0}},s={args:{icon:e.jsx(o,{className:"size-4"}),label:"Totaal runs",value:156,title:"Aantal scraper-runs in de afgelopen 30 dagen"}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    icon: <BarChart3Icon className="size-4" />,
    label: "Actieve vacatures",
    value: 42
  }
}`,...a.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    icon: <BarChart3Icon className="size-4" />,
    label: "Nieuwe deze week",
    value: "12",
    valueClassName: "text-green-600"
  }
}`,...r.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    icon: <BarChart3Icon className="size-3" />,
    label: "Matches",
    value: 8,
    compact: true
  }
}`,...t.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    icon: <BarChart3Icon className="size-4" />,
    label: "Totaal runs",
    value: 156,
    title: "Aantal scraper-runs in de afgelopen 30 dagen"
  }
}`,...s.parameters?.docs?.source}}};const z=["Default","WithTrend","Compact","WithTooltip"];export{t as Compact,a as Default,s as WithTooltip,r as WithTrend,z as __namedExportsOrder,k as default};
