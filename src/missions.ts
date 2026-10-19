export const missions=[
 {number:1,label:'Elegí tu máquina',tag:'SELECCIÓN DE EQUIPO',description:'La jornada empieza en el galpón. Cada cultivo necesita una máquina diferente. Elegí el tractor indicado para cada trabajo.',scene:'galpon',start:0,end:2},
 {number:2,label:'El desafío de la tracción',tag:'RUMBO AL LOTE',description:'El implemento está listo. Ahora necesitás que la potencia llegue al suelo. Elegí el rodado y calibrá la tracción.',scene:'campo',start:2,end:4},
 {number:3,label:'El corazón de la máquina',tag:'CABINA DE CONTROL',description:'Entrás a la cabina. Poné a punto el motor diésel y preparalo para un tramo de tierra difícil.',scene:'cabina',start:4,end:6},
 {number:4,label:'Conectá la potencia',tag:'ZONA DE ACOPLE',description:'Es hora de conectar los implementos. Tocá un componente del tractor y después su función. Tres conexiones para seguir.',scene:'acople',start:6,end:9},
 {number:5,label:'Salvá la jornada',tag:'LA ÚLTIMA VUELTA',description:'Queda el último lote y la vuelta al galpón. Cuidá el agarre, la transmisión y el motor para terminar la jornada.',scene:'regreso',start:9,end:12},
]
export const classification=(score:number)=>score>=900?'Maestro de la potencia':score>=700?'Operador experto':score>=500?'Operador en entrenamiento':'Aprendiz agrícola'
