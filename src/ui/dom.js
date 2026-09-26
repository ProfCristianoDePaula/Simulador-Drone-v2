export function element(tag,text='',className=''){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
export function link(text,href){const el=element('a',text,'button');el.href=href;return el;}
export function field(label,type='text',value=''){const box=element('label',label);const input=element('input');input.type=type;input.value=value;box.append(input);return {box,input};}
export function choice(label,items,value){const box=element('label',label),input=element('select');for(const [key,text] of items){const option=element('option',text);option.value=key;input.append(option);}input.value=value??items[0]?.[0];box.append(input);return {box,input};}
export function csvCell(value){let text=String(value??'');if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
