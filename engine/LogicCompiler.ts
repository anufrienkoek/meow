import { LogicEvent, LogicAction } from '../types';

export class LogicCompiler {
  
  static compile(events: LogicEvent[]): string {
    if (!events || events.length === 0) return '';

    let code = `
      // Auto-generated Logic
    `;

    events.forEach(event => {
       if (!event.actions || event.actions.length === 0) return;

       const actionsCode = event.actions.map(action => this.compileAction(action)).join('\n');

       if (event.type === 'ON_START') {
         code += `
           events.onStart = async function() {
             try {
               ${actionsCode}
             } catch(err) {
               console.error("Error in onStart:", err);
             }
           };
         `;
       } else if (event.type === 'ON_CLICK') {
         code += `
           events.onClick = async function() {
             try {
               ${actionsCode}
             } catch(err) {
               console.error("Error in onClick:", err);
             }
           };
         `;
       }
    });

    return code;
  }

  private static compileAction(action: LogicAction): string {
    const p = action.params || {};
    
    // Safety helpers
    const num = (v: any, def: number) => isNaN(Number(v)) ? def : Number(v);
    const str = (v: any, def: string) => String(v || def);
    const bool = (v: any) => v === true || v === 'true';

    // NOTE: We do NOT use 'this.' here. The execution context provides these functions
    // as local variables via closure from the InteractionEngine's createBehavior function.
    switch (action.type) {
      case 'MOVE':
        return `await moveBy('${str(p.axis, 'x')}', ${num(p.amount, 1)});`;
      
      case 'ROTATE':
        return `await rotateBy('${str(p.axis, 'y')}', ${num(p.amount, 90)});`;
      
      case 'SCALE':
        return `setScale(${num(p.scale, 1)});`;
      
      case 'COLOR':
        return `setColor('${str(p.color, '#ffffff')}');`;
      
      case 'WAIT':
        return `await wait(${num(p.seconds, 1)});`;

      case 'VISIBLE':
        return `setVisible(${bool(p.visible)});`;
        
      default:
        return '';
    }
  }
}