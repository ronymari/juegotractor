export interface Option {id:string;label:string;value?:number|string;efficiency?:number}
export interface Question {id:string;seq:number;mission:number;points:number;kind:string;title:string;prompt:string;options:Option[]}
export interface Review {id:string;mission:number;title:string;correct:boolean;points:number;answer:string;explanation:string}
export interface BoardEntry {id:string;name:string;score:number;next:number;missions:number;finished:boolean;rank:number|null;online:boolean}
export interface State {room:{id:string;code:string;title:string;status:'lobby'|'running'|'closed'};teacher:boolean;player:{id:string;name:string;score:number;next:number;finished:boolean}|null;question:Question|null;board:BoardEntry[];review:Review|null;history:Review[]}
export interface RoomSummary {code:string;title:string;status:string}
