import{j as e}from"./iframe-kI-p6Njh.js";import"./preload-helper-PPVm8Dsz.js";function n({title:a,description:i,children:o}){return e.jsxs("div",{className:"mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",children:[e.jsxs("div",{className:"min-w-0 space-y-1",children:[e.jsx("h1",{className:"break-words text-2xl font-bold text-foreground",children:a}),i&&e.jsx("p",{className:"max-w-3xl text-sm text-muted-foreground",children:i})]}),o&&e.jsx("div",{className:"flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:self-start",children:o})]})}n.__docgenInfo={description:"",methods:[],displayName:"PageHeader",props:{title:{required:!0,tsType:{name:"string"},description:""},description:{required:!1,tsType:{name:"string"},description:""},children:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""}}};const p={title:"Components/PageHeader",component:n,tags:["autodocs"],argTypes:{title:{control:"text"},description:{control:"text"}},parameters:{docs:{description:{component:"Pagina-header met optionele titel, beschrijving en acties."}}}},t={args:{title:"Opdrachten"}},r={args:{title:"Opdrachten",description:"Beheer en bekijk alle beschikbare opdrachten"}},s={args:{title:"Scraper configuraties",description:"Configureer en beheer uw scrapers"},render:a=>e.jsx(n,{...a,children:e.jsx("button",{type:"button",className:"px-4 py-2 text-sm bg-[#10a37f] text-white rounded-lg hover:bg-[#10a37f]/90",children:"Nieuwe configuratie"})})};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    title: "Opdrachten"
  }
}`,...t.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    title: "Opdrachten",
    description: "Beheer en bekijk alle beschikbare opdrachten"
  }
}`,...r.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    title: "Scraper configuraties",
    description: "Configureer en beheer uw scrapers"
  },
  render: args => <PageHeader {...args}>
      <button type="button" className="px-4 py-2 text-sm bg-[#10a37f] text-white rounded-lg hover:bg-[#10a37f]/90">
        Nieuwe configuratie
      </button>
    </PageHeader>
}`,...s.parameters?.docs?.source}}};const l=["TitleOnly","WithDescription","WithActions"];export{t as TitleOnly,s as WithActions,r as WithDescription,l as __namedExportsOrder,p as default};
