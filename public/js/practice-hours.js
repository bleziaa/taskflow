(function () {
  'use strict';
  let sequence = 0;
  const days = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  function el(tag,text,className) { const e=document.createElement(tag); if(text)e.textContent=text;if(className)e.className=className;return e; }
  function field(label,type,name,value='') {
    const wrapper=el('label',label),input=el(type==='textarea'?'textarea':'input');
    if(type!=='textarea')input.type=type;
    input.name=name;input.value=value;input.defaultValue=String(value);wrapper.append(input);return {wrapper,input};
  }
  function scheduleFields(practice={}) {
    const box=el('fieldset',null,'practice-schedule-fields');box.dataset.scheduleFields='true';box.append(el('legend','Horario y meta de horas'));
    const dayBox=el('fieldset',null,'practice-day-options');dayBox.append(el('legend','Días de asistencia'));
    days.forEach((day,i)=>{const f=field(day,'checkbox','schedule-days',String(i+1));f.input.checked=(practice.horario?.dias||[]).includes(i+1);f.input.defaultChecked=f.input.checked;dayBox.append(f.wrapper);});
    const grid=el('div',null,'practice-hours-grid');
    for(const [label,type,name,value] of [
      ['Hora de entrada','time','schedule-start',practice.horario?.entrada||''],
      ['Hora de salida','time','schedule-end',practice.horario?.salida||''],
      ['Descanso diario (minutos)','number','schedule-break',practice.horario?.descansoMinutos||0],
      ['Horas requeridas en total (0: sin meta)','number','schedule-goal',practice.horasRequeridas||0]
    ]) {const f=field(label,type,name,value);if(type==='number'){f.input.min='0';f.input.step='1';f.input.max=name==='schedule-goal'?'10000':'1438';}grid.append(f.wrapper);}
    box.append(dayBox,grid,el('p','Horario habitual en hora de Colombia. El descanso se descuenta de cada jornada. Puedes dejar el horario sin definir; las horas reportadas siempre requieren revisión.','practice-hours-help'));return box;
  }
  function readSchedule(root) {
    const value=name=>root.querySelector('[name="'+name+'"]').value;
    return {horario:{dias:[...root.querySelectorAll('[name="schedule-days"]:checked')].map(e=>Number(e.value)),entrada:value('schedule-start'),salida:value('schedule-end'),descansoMinutos:Number(value('schedule-break'))},horasRequeridas:Number(value('schedule-goal'))};
  }
  const fmtMinutes=value=>(Number(value||0)/60).toLocaleString('es-CO',{maximumFractionDigits:2})+' h';
  const fmtDate=value=>new Date(String(value).slice(0,10)+'T12:00:00Z').toLocaleDateString('es-CO');
  function attach(card,practice,role,api,mutate) {
    const box=el('section',null,'practice-hours');box.setAttribute('aria-label','Horario y horas de '+practice.titulo);
    const summary=el('div');
    function renderSchedule() {
      summary.replaceChildren(el('h3','Horario y horas'));
      const h=practice.horario;
      summary.append(el('p',h?.dias?.length? h.dias.map(d=>days[d-1]).join(', ')+' · '+h.entrada+' a '+h.salida+' · Descanso: '+h.descansoMinutos+' min · Hora de Colombia.':'Horario semanal pendiente de definir.'));
      summary.append(el('p',practice.horasRequeridas?'Meta total: '+practice.horasRequeridas+' horas.':'Meta de horas pendiente de definir.'));
    }
    renderSchedule();box.append(summary);
    const feedback=el('p',null,'practice-hours-message');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');box.append(feedback);
    const notify=(message,error=false)=>{feedback.textContent=message;feedback.classList.toggle('is-error',error);};
    if(role!=='estudiante') {
      const details=el('details');details.append(el('summary','Configurar horario y meta'));
      const form=el('form');form.append(scheduleFields(practice));const save=el('button','Guardar horario','btn btn-secundario');save.type='submit';form.append(save);
      form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{const data=await mutate('/api/organization/practices/'+practice._id+'/schedule','PUT',readSchedule(form));Object.assign(practice,data);renderSchedule();details.open=false;notify('Horario y meta guardados.');if(!panel.hidden)await refresh();}catch(e){notify(e.message,true);}finally{save.disabled=false;}});
      details.append(form);box.append(details);
    }
    const toggle=el('button',role==='estudiante'?'Ver y registrar horas':'Ver y revisar horas','btn btn-secundario');toggle.type='button';toggle.setAttribute('aria-expanded','false');
    const panel=el('div');panel.hidden=true;panel.id='practice-hours-panel-'+(++sequence);toggle.setAttribute('aria-controls',panel.id);
    const totals=el('div',null,'practice-hours-totals'),records=el('div',null,'practice-attendance-list');
    const reload=el('button','Actualizar jornadas','btn btn-secundario btn-sm');reload.type='button';reload.addEventListener('click',()=>refresh());
    panel.append(totals,reload);
    let reportForm, reportFields, correcting;
    if(role==='estudiante'&&practice.estado==='en_curso') {
      reportForm=el('form',null,'practice-attendance-form');reportForm.append(el('h4','Reportar jornada realizada'));
      reportFields={};
      for(const [name,label,type,value] of [
        ['fecha','Fecha de asistencia','date',''],['entrada','Entrada real','time',practice.horario?.entrada||''],['salida','Salida real','time',practice.horario?.salida||''],['descansoMinutos','Descanso real (minutos)','number',practice.horario?.descansoMinutos||0],['descripcion','¿Qué realizaste durante esta jornada?','textarea','']
      ]){const f=field(label,type,name,value);reportFields[name]=f.input;f.input.required=true;if(type==='number'){f.input.min=0;f.input.max=1438;f.input.step=1;}if(type==='textarea'){f.input.minLength=5;f.input.maxLength=2000;f.input.rows=3;}reportForm.append(f.wrapper);}
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      reportFields.fecha.min=String(practice.fechaInicio).slice(0,10);reportFields.fecha.max=[String(practice.fechaFin).slice(0,10),today].sort()[0];
      const save=el('button','Enviar jornada al tutor','btn btn-primario');save.type='submit';
      const cancel=el('button','Cancelar corrección','btn btn-secundario');cancel.type='button';cancel.hidden=true;
      function resetReport(){reportForm.reset();reportFields.fecha.readOnly=false;correcting=null;cancel.hidden=true;save.textContent='Enviar jornada al tutor';}
      cancel.addEventListener('click',resetReport);
      reportForm.append(el('p','Una jornada por fecha. Se descuentan los descansos. Las horas quedan pendientes hasta su aprobación. Si el tutor la rechaza, podrás corregirla.','practice-hours-help'),save,cancel);
      reportForm.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{
        const data=Object.fromEntries(Object.entries(reportFields).map(([key,input])=>[key,input.value]));data.descansoMinutos=Number(data.descansoMinutos);if(correcting)data.revision=correcting.revision;
        await mutate('/api/organization/practices/'+practice._id+'/attendance/'+encodeURIComponent(data.fecha),'PUT',data);resetReport();await refresh();notify('Jornada enviada. Sus horas están pendientes de aprobación.');
      }catch(e){notify(e.message,true);}finally{save.disabled=false;}});
      panel.append(reportForm);
      panel.correct=(row)=>{correcting=row;for(const [key,input]of Object.entries(reportFields))input.value=row[key];reportFields.fecha.readOnly=true;cancel.hidden=false;save.textContent='Enviar jornada corregida';reportForm.scrollIntoView({behavior:'smooth',block:'center'});};
    } else if(role==='estudiante') panel.append(el('p','El registro de nuevas horas está disponible cuando la práctica está en curso.'));
    panel.append(records);
    async function refresh() {
      reload.disabled=true;
      try {
        const {registros,resumen,limite}=await api('/api/organization/practices/'+practice._id+'/attendance');
        totals.replaceChildren(el('p','Horas aprobadas: '+fmtMinutes(resumen.aprobada)+' · Pendientes: '+fmtMinutes(resumen.pendiente)+' · Rechazadas: '+fmtMinutes(resumen.rechazada)));
        if(resumen.horasRequeridas){const approved=Number(resumen.aprobada||0),target=resumen.horasRequeridas*60;const progress=el('progress');progress.max=target;progress.value=Math.min(approved,target);progress.setAttribute('aria-label','Avance de horas aprobadas');totals.append(progress,el('p','Faltan '+fmtMinutes(Math.max(0,target-approved))+' para cumplir la meta de '+resumen.horasRequeridas+' h.'));}
        records.replaceChildren(el('h4','Jornadas registradas'),el('p','Se muestran las últimas '+limite+' jornadas. Los totales incluyen todo el historial.','practice-hours-help'));
        if(!registros.length)records.append(el('p','Aún no hay jornadas registradas.'));
        for(const row of registros){const item=el('article',null,'practice-attendance-item');
          item.append(el('h5',fmtDate(row.fecha)+' · '+fmtMinutes(row.minutos)+' · '+({pendiente:'Pendiente de revisión',aprobada:'Aprobada',rechazada:'Requiere corrección'}[row.estado])),el('p',row.entrada+' a '+row.salida+' · Descanso: '+row.descansoMinutos+' min'),el('p',row.descripcion));
          if(row.observacion)item.append(el('p','Observación del revisor: '+row.observacion));
          if(row.revisadoPor)item.append(el('p','Revisado por: '+row.revisadoPor.nombre));
          if(role==='estudiante'&&row.estado==='rechazada'&&reportForm){const edit=el('button','Corregir jornada','btn btn-secundario btn-sm');edit.type='button';edit.addEventListener('click',()=>panel.correct(row));item.append(edit);}
          if(role!=='estudiante'&&row.estado==='pendiente'){
            const form=el('form',null,'practice-attendance-review');const decision=el('label','Decisión sobre la jornada'),select=el('select');select.name='estado';select.append(new Option('Aprobar horas','aprobada'),new Option('Solicitar corrección','rechazada'));decision.append(select);
            const note=field('Observaciones de revisión','textarea','observacion');note.input.maxLength=2000;note.input.rows=2;
            select.addEventListener('change',()=>{note.input.required=select.value==='rechazada';note.input.minLength=select.value==='rechazada'?5:0;});
            const save=el('button','Guardar revisión de horas','btn btn-primario btn-sm');save.type='submit';form.append(decision,note.wrapper,save);
            form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{await mutate('/api/organization/practices/'+practice._id+'/attendance/'+row._id+'/review','PATCH',{estado:select.value,observacion:note.input.value,revision:row.revision});await refresh();notify('Revisión guardada. Los totales de horas se actualizaron.');}catch(e){notify(e.message,true);}finally{save.disabled=false;}});item.append(form);
          }
          if(row.historial?.length){const history=el('details');history.append(el('summary','Historial de revisiones'));row.historial.forEach(review=>history.append(el('p',(review.estado==='aprobada'?'Aprobada':'Rechazada')+' por '+(review.revisadoPor?.nombre||'Revisor')+(review.observacion?': '+review.observacion:''))));item.append(history);}
          records.append(item);
        }
      }catch(e){notify(e.message,true);}finally{reload.disabled=false;}
    }
    toggle.addEventListener('click',async()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)await refresh();});
    box.append(toggle,panel);card.append(box);
  }
  window.TaskFlowPracticeHours={scheduleFields,readSchedule,attach,fmtDate};
})();
