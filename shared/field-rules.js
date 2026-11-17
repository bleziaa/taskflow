(function(root,factory){
  const rules=factory();
  if(typeof module==='object'&&module.exports) module.exports=rules;
  if(root) root.TaskFlowFieldRules=rules;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function isValidPhone(value){
    const phone=String(value??'').trim();
    if(!phone) return true;
    if(phone.length>25 || !/^[+0-9(). -]+$/.test(phone)) return false;
    const digits=phone.replace(/\D/g,'');
    return digits.length>=7 && digits.length<=15;
  }
  return Object.freeze({
    studentCodePattern:'^[A-Za-z0-9._-]+$',studentCodeMax:30,
    studentNameMin:2,studentNameMax:120,studentEmailMax:254,
    studentPhoneMax:25,studentPhoneMinDigits:7,studentPhoneMaxDigits:15,
    studentProgramMin:2,studentProgramMax:120,semesterMin:1,semesterMax:12,
    profileNameMax:120,
    companyNameMin:2,companyNameMax:140,companyNitMax:30,
    companySectorMax:100,companyAddressMax:180,companyCityMin:2,
    companyCityMax:100,companyContactNameMax:120,
    companyContactEmailMax:254,companyPhoneMax:25,isValidPhone
  });
});
