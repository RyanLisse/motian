import{j as e}from"./iframe-kI-p6Njh.js";import{B as l}from"./button-Bcibxs5Y.js";import{c as a}from"./utils-BQHNewu7.js";import"./preload-helper-PPVm8Dsz.js";import"./index-LHNt3CwB.js";import"./index-fq99SDQe.js";function d({className:r,...t}){return e.jsx("div",{"data-slot":"card",className:a("bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",r),...t})}function s({className:r,...t}){return e.jsx("div",{"data-slot":"card-header",className:a("@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",r),...t})}function i({className:r,...t}){return e.jsx("div",{"data-slot":"card-title",className:a("leading-none font-semibold",r),...t})}function c({className:r,...t}){return e.jsx("div",{"data-slot":"card-description",className:a("text-muted-foreground text-sm",r),...t})}function m({className:r,...t}){return e.jsx("div",{"data-slot":"card-content",className:a("px-6",r),...t})}function p({className:r,...t}){return e.jsx("div",{"data-slot":"card-footer",className:a("flex items-center px-6 [.border-t]:pt-6",r),...t})}d.__docgenInfo={description:"",methods:[],displayName:"Card"};s.__docgenInfo={description:"",methods:[],displayName:"CardHeader"};p.__docgenInfo={description:"",methods:[],displayName:"CardFooter"};i.__docgenInfo={description:"",methods:[],displayName:"CardTitle"};c.__docgenInfo={description:"",methods:[],displayName:"CardDescription"};m.__docgenInfo={description:"",methods:[],displayName:"CardContent"};const g={title:"Components/Card",component:d,tags:["autodocs"],parameters:{docs:{description:{component:"Kaartcontainer met optionele header (titel, beschrijving, actie), content en footer. Gebruikt voor blokken op dashboards en formulieren."}}}},n={render:()=>e.jsxs(d,{children:[e.jsxs(s,{children:[e.jsx(i,{children:"Vacaturekaart"}),e.jsx(c,{children:"Korte omschrijving van de vacature of sectie."})]}),e.jsx(m,{children:e.jsx("p",{className:"text-sm text-muted-foreground",children:"Hier staat de hoofdinhoud van de kaart. Bijvoorbeeld een samenvatting of formuliervelden."})}),e.jsxs(p,{children:[e.jsx(l,{variant:"outline",size:"sm",children:"Annuleren"}),e.jsx(l,{size:"sm",children:"Opslaan"})]})]})},o={render:()=>e.jsx(d,{children:e.jsxs(s,{children:[e.jsx(i,{children:"Alleen titel"}),e.jsx(c,{children:"Optionele beschrijving onder de titel."})]})})};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  render: () => <Card>
      <CardHeader>
        <CardTitle>Vacaturekaart</CardTitle>
        <CardDescription>Korte omschrijving van de vacature of sectie.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Hier staat de hoofdinhoud van de kaart. Bijvoorbeeld een samenvatting of formuliervelden.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm">
          Annuleren
        </Button>
        <Button size="sm">Opslaan</Button>
      </CardFooter>
    </Card>
}`,...n.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: () => <Card>
      <CardHeader>
        <CardTitle>Alleen titel</CardTitle>
        <CardDescription>Optionele beschrijving onder de titel.</CardDescription>
      </CardHeader>
    </Card>
}`,...o.parameters?.docs?.source}}};const v=["Default","HeaderOnly"];export{n as Default,o as HeaderOnly,v as __namedExportsOrder,g as default};
