import{I as s}from"./input-Bp_9V8Xn.js";import"./iframe-kI-p6Njh.js";import"./preload-helper-PPVm8Dsz.js";import"./utils-BQHNewu7.js";const p={title:"Components/Input",component:s,tags:["autodocs"],parameters:{docs:{description:{component:"Tekstinvoerveld voor formulieren. Ondersteunt placeholder, disabled en type (text, email, etc.)."}}},argTypes:{type:{control:"select",options:["text","email","password","number"]},disabled:{control:"boolean"},placeholder:{control:"text"}}},e={args:{placeholder:"Voer tekst in...",type:"text"}},r={args:{defaultValue:"Bestaande waarde",type:"text"}},a={args:{placeholder:"Uitgeschakeld veld",disabled:!0,type:"text"}},t={args:{placeholder:"Wachtwoord",type:"password"}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    placeholder: "Voer tekst in...",
    type: "text"
  }
}`,...e.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    defaultValue: "Bestaande waarde",
    type: "text"
  }
}`,...r.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    placeholder: "Uitgeschakeld veld",
    disabled: true,
    type: "text"
  }
}`,...a.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    placeholder: "Wachtwoord",
    type: "password"
  }
}`,...t.parameters?.docs?.source}}};const l=["Default","WithValue","Disabled","Password"];export{e as Default,a as Disabled,t as Password,r as WithValue,l as __namedExportsOrder,p as default};
