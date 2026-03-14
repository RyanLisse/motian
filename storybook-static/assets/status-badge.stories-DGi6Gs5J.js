import{j as u}from"./iframe-kI-p6Njh.js";import{B as m}from"./badge-C1tah0Be.js";import{c as p}from"./utils-BQHNewu7.js";import"./preload-helper-PPVm8Dsz.js";import"./index-LHNt3CwB.js";import"./index-fq99SDQe.js";const g={success:{label:"Geslaagd",className:"bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"},partial:{label:"Gedeeltelijk",className:"bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:text-yellow-400"},failed:{label:"Mislukt",className:"bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400"},gezond:{label:"Gezond",className:"bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"},waarschuwing:{label:"Waarschuwing",className:"bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:text-yellow-400"},kritiek:{label:"Kritiek",className:"bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400"},inactief:{label:"Inactief",className:"bg-muted text-muted-foreground border-border"}};function i({status:n,className:l}){const d=g[n]??{label:n,className:"bg-muted text-muted-foreground border-border"};return u.jsx(m,{variant:"outline",className:p(d.className,l),children:d.label})}i.__docgenInfo={description:"",methods:[],displayName:"StatusBadge",props:{status:{required:!0,tsType:{name:"string"},description:""},className:{required:!1,tsType:{name:"string"},description:""}}};const y={title:"Components/StatusBadge",component:i,tags:["autodocs"],argTypes:{status:{control:"select",options:["success","partial","failed","gezond","waarschuwing","kritiek","inactief"]}},parameters:{docs:{description:{component:"Statusbadge voor scraper runs en gezondheidsindicatoren (dashboard, runlijst)."}}}},e={args:{status:"success"}},a={args:{status:"partial"}},r={args:{status:"failed"}},s={args:{status:"gezond"}},t={args:{status:"waarschuwing"}},o={args:{status:"kritiek"}},c={args:{status:"inactief"}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    status: "success"
  }
}`,...e.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    status: "partial"
  }
}`,...a.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    status: "failed"
  }
}`,...r.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    status: "gezond"
  }
}`,...s.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    status: "waarschuwing"
  }
}`,...t.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    status: "kritiek"
  }
}`,...o.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    status: "inactief"
  }
}`,...c.parameters?.docs?.source}}};const N=["Success","Partial","Failed","Gezond","Waarschuwing","Kritiek","Inactief"];export{r as Failed,s as Gezond,c as Inactief,o as Kritiek,a as Partial,e as Success,t as Waarschuwing,N as __namedExportsOrder,y as default};
