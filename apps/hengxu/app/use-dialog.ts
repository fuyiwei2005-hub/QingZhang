"use client";
import {useEffect,useRef} from "react";
export function useDialog<T extends HTMLElement>(onClose:()=>void,blocked=false){
 const root=useRef<T>(null);const latest=useRef({onClose,blocked});latest.current={onClose,blocked};
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const panel=root.current;
  const elements=()=>Array.from(panel?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled]),summary,[tabindex="0"]')||[]).filter(e=>e.getClientRects().length);
  if(panel&&!panel.contains(document.activeElement))elements()[0]?.focus();
  function key(event:KeyboardEvent){if(event.key==="Escape"){event.preventDefault();if(!latest.current.blocked)latest.current.onClose();}if(event.key==="Tab"){const nodes=elements(),first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}}
  document.addEventListener("keydown",key);return()=>{document.removeEventListener("keydown",key);if(previous?.isConnected&&!panel?.contains(previous))previous.focus();};
 },[]);return root;
}
