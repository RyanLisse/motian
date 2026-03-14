import{j as e}from"./iframe-kI-p6Njh.js";import{c}from"./createLucideIcon-BnV1XlTb.js";import"./preload-helper-PPVm8Dsz.js";const d=[["polyline",{points:"22 12 16 12 14 15 10 15 8 12 2 12",key:"o97t9d"}],["path",{d:"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",key:"oot6mr"}]],l=c("inbox",d);function o({icon:s,title:i,subtitle:r}){return e.jsxs("div",{className:"text-center py-16 text-muted-foreground",children:[s&&e.jsx("div",{className:"flex justify-center mb-3",children:s}),e.jsx("p",{className:"text-lg",children:i}),r&&e.jsx("p",{className:"text-sm mt-1",children:r})]})}o.__docgenInfo={description:"",methods:[],displayName:"EmptyState",props:{icon:{required:!1,tsType:{name:"ReactNode"},description:""},title:{required:!0,tsType:{name:"string"},description:""},subtitle:{required:!1,tsType:{name:"string"},description:""}}};const g={title:"Components/EmptyState",component:o,tags:["autodocs"],parameters:{docs:{description:{component:"Lege staat wanneer er geen resultaten zijn. Titel verplicht; optioneel subtitel en icoon. Gebruikt bij lege filters, geen vacatures, geen kandidaten."}}},argTypes:{title:{control:"text"},subtitle:{control:"text"}}},t={args:{title:"Geen vacatures gevonden"}},n={args:{title:"Geen resultaten",subtitle:"Pas de filters aan of voeg een nieuwe vacature toe."}},a={args:{icon:e.jsx(l,{className:"size-12 text-muted-foreground"}),title:"Nog geen kandidaten",subtitle:"Koppel kandidaten via de matching-pagina."}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    title: "Geen vacatures gevonden"
  }
}`,...t.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    title: "Geen resultaten",
    subtitle: "Pas de filters aan of voeg een nieuwe vacature toe."
  }
}`,...n.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    icon: <InboxIcon className="size-12 text-muted-foreground" />,
    title: "Nog geen kandidaten",
    subtitle: "Koppel kandidaten via de matching-pagina."
  }
}`,...a.parameters?.docs?.source}}};const x=["TitleOnly","WithSubtitle","WithIcon"];export{t as TitleOnly,a as WithIcon,n as WithSubtitle,x as __namedExportsOrder,g as default};
