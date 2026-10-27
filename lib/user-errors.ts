export function publicError(message:unknown,status:number){
 const text=typeof message==="string"?message:"";
 if(status===401)return "登录已过期，请重新登录后继续";
 if(status===403)return "暂时无法完成此操作，请刷新页面后重试";
 if(status===413)return "内容过大，请缩小图片或分批处理";
 if(status===429)return text.includes("今日")||text.includes("限额")?"今日使用次数已用完，或上一条请求仍在处理中，请稍后再试":"请求较多，请稍后再试";
 if(/超时|timeout|aborted/i.test(text))return "处理时间较长，请稍后重试，输入内容已保留";
 if(/密钥|API.?Key|token|管理员|模型尚未配置/i.test(text)||status===503)return "AI 服务暂时不可用，请稍后再试";
 const technical=/JSON|SyntaxError|TypeError|SQL|D1_|stack|fetch failed|NetworkError|https?:\/\/|[A-Z]:[\\/]|\/(?:opt|etc|tmp|home)\//i.test(text);
 if(text&&!technical&&/[\u4e00-\u9fff]/.test(text)&&text.length<=200)return text;
 return status>=500?"服务暂时不可用，请稍后重试":"操作未完成，请检查内容后重试";
}
