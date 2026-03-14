import{j as r}from"./iframe-kI-p6Njh.js";import{L as d}from"./link-CYjKAWmV.js";import"./preload-helper-PPVm8Dsz.js";function g({page:e,totalPages:s,buildHref:i}){return s<=1?null:r.jsxs("div",{className:"flex items-center justify-center gap-2 pt-4",children:[e>1&&r.jsx(d,{href:i(e-1),className:"h-9 px-4 flex items-center bg-card border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",children:"Vorige"}),r.jsxs("span",{className:"text-sm text-muted-foreground px-2",children:[e," / ",s]}),e<s&&r.jsx(d,{href:i(e+1),className:"h-9 px-4 flex items-center bg-card border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",children:"Volgende"})]})}g.__docgenInfo={description:"",methods:[],displayName:"Pagination",props:{page:{required:!0,tsType:{name:"number"},description:""},totalPages:{required:!0,tsType:{name:"number"},description:""},buildHref:{required:!0,tsType:{name:"signature",type:"function",raw:"(page: number) => string",signature:{arguments:[{type:{name:"number"},name:"page"}],return:{name:"string"}}},description:"Build the href for a given page number"}}};function o(e){return`?page=${e}`}const p={title:"Components/Pagination",component:g,tags:["autodocs"],parameters:{docs:{description:{component:"Vorige/Volgende-paginering met pagina-indicator. Link-gebaseerd via buildHref. Verbergt zich bij totalPages <= 1."}}},argTypes:{page:{control:"number"},totalPages:{control:"number"}}},t={args:{page:1,totalPages:5,buildHref:o}},a={args:{page:3,totalPages:8,buildHref:o}},n={args:{page:5,totalPages:5,buildHref:o}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    page: 1,
    totalPages: 5,
    buildHref
  }
}`,...t.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    page: 3,
    totalPages: 8,
    buildHref
  }
}`,...a.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    page: 5,
    totalPages: 5,
    buildHref
  }
}`,...n.parameters?.docs?.source}}};const l=["FirstPage","MiddlePage","LastPage"];export{t as FirstPage,n as LastPage,a as MiddlePage,l as __namedExportsOrder,p as default};
