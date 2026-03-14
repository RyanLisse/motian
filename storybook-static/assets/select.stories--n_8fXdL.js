import{j as e}from"./iframe-kI-p6Njh.js";import{S as s,b as c,c as a,d as n,e as t}from"./select-BVr_7sP-.js";import"./preload-helper-PPVm8Dsz.js";import"./utils-BQHNewu7.js";import"./createLucideIcon-BnV1XlTb.js";import"./check-3dOCq0OZ.js";import"./index-BET7DJW4.js";import"./index-fq99SDQe.js";const h={title:"Components/Select",component:s,tags:["autodocs"],parameters:{docs:{description:{component:"Dropdownselectie met trigger en opties. Gebruikt voor platform, status, contracttype en andere enums."}}}},r={render:()=>e.jsxs(s,{children:[e.jsx(c,{className:"w-[200px]",children:e.jsx(a,{placeholder:"Kies een optie"})}),e.jsxs(n,{children:[e.jsx(t,{value:"striive",children:"Striive"}),e.jsx(t,{value:"huxley",children:"Huxley"}),e.jsx(t,{value:"computer-futures",children:"Computer Futures"})]})]})},l={render:()=>e.jsxs(s,{defaultValue:"huxley",children:[e.jsx(c,{className:"w-[200px]",children:e.jsx(a,{placeholder:"Platform"})}),e.jsxs(n,{children:[e.jsx(t,{value:"striive",children:"Striive"}),e.jsx(t,{value:"huxley",children:"Huxley"}),e.jsx(t,{value:"computer-futures",children:"Computer Futures"})]})]})};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  render: () => <Select>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Kies een optie" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="striive">Striive</SelectItem>
        <SelectItem value="huxley">Huxley</SelectItem>
        <SelectItem value="computer-futures">Computer Futures</SelectItem>
      </SelectContent>
    </Select>
}`,...r.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: () => <Select defaultValue="huxley">
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Platform" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="striive">Striive</SelectItem>
        <SelectItem value="huxley">Huxley</SelectItem>
        <SelectItem value="computer-futures">Computer Futures</SelectItem>
      </SelectContent>
    </Select>
}`,...l.parameters?.docs?.source}}};const v=["Default","WithDefaultValue"];export{r as Default,l as WithDefaultValue,v as __namedExportsOrder,h as default};
