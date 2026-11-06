-- Refuerza aislamiento: las relaciones academicas deben pertenecer a la misma organizacion.
ALTER TABLE academic_companies
  ADD UNIQUE KEY uq_companies_org_id (organization_id, id);

ALTER TABLE academic_students
  ADD UNIQUE KEY uq_students_org_id (organization_id, id),
  ADD CONSTRAINT fk_students_company_tenant FOREIGN KEY (organization_id, company_id)
    REFERENCES academic_companies (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE academic_practices
  ADD UNIQUE KEY uq_practices_org_id (organization_id, id),
  DROP FOREIGN KEY fk_practices_student,
  DROP FOREIGN KEY fk_practices_company,
  ADD CONSTRAINT fk_practices_student_tenant FOREIGN KEY (organization_id, student_id)
    REFERENCES academic_students (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT fk_practices_company_tenant FOREIGN KEY (organization_id, company_id)
    REFERENCES academic_companies (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE academic_activities
  ADD UNIQUE KEY uq_activities_org_id (organization_id, id),
  DROP FOREIGN KEY fk_activities_practice,
  ADD CONSTRAINT fk_activities_practice_tenant FOREIGN KEY (organization_id, practice_id)
    REFERENCES academic_practices (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE academic_evidences
  DROP FOREIGN KEY fk_evidences_activity,
  DROP FOREIGN KEY fk_evidences_student,
  ADD CONSTRAINT fk_evidences_activity_tenant FOREIGN KEY (organization_id, activity_id)
    REFERENCES academic_activities (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT fk_evidences_student_tenant FOREIGN KEY (organization_id, student_id)
    REFERENCES academic_students (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE academic_evaluations
  DROP FOREIGN KEY fk_evaluations_practice,
  DROP FOREIGN KEY fk_evaluations_student,
  ADD CONSTRAINT fk_evaluations_practice_tenant FOREIGN KEY (organization_id, practice_id)
    REFERENCES academic_practices (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT fk_evaluations_student_tenant FOREIGN KEY (organization_id, student_id)
    REFERENCES academic_students (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;
