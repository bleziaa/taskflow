-- TaskFlow: módulos configurables por curso y actividades ligadas a un módulo obligatorio.
CREATE TABLE IF NOT EXISTS academic_course_modules (
  id CHAR(24) NOT NULL,
  organization_id CHAR(24) NOT NULL,
  course_id CHAR(24) NOT NULL,
  module_number SMALLINT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT NULL,
  status ENUM('activo','inactivo','archivado') NOT NULL DEFAULT 'activo',
  created_by_user_id CHAR(24) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_course_module_number (organization_id, course_id, module_number),
  UNIQUE KEY uq_course_module_org_course_id (organization_id, course_id, id),
  KEY idx_course_modules_order (organization_id, course_id, status, module_number),
  CONSTRAINT fk_course_modules_course FOREIGN KEY (organization_id, course_id)
    REFERENCES academic_courses (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE academic_course_activities
  ADD COLUMN module_id CHAR(24) NULL AFTER course_id;

-- Conserva las actividades ya existentes: se agrupan inicialmente en el módulo 1 de su curso.
INSERT INTO academic_course_modules
  (id, organization_id, course_id, module_number, title, description, created_by_user_id)
SELECT SUBSTRING(REPLACE(UUID(), '-', ''), 1, 24), c.organization_id, c.id, 1,
       'Módulo 1', 'Módulo inicial creado para conservar las actividades existentes del curso.',
       c.created_by_user_id
FROM academic_courses c
WHERE NOT EXISTS (
  SELECT 1 FROM academic_course_modules m
  WHERE m.organization_id = c.organization_id AND m.course_id = c.id
);

UPDATE academic_course_activities a
JOIN academic_course_modules m
  ON m.organization_id = a.organization_id
 AND m.course_id = a.course_id
 AND m.module_number = 1
SET a.module_id = m.id
WHERE a.module_id IS NULL;

ALTER TABLE academic_course_activities
  MODIFY COLUMN module_id CHAR(24) NOT NULL,
  ADD KEY idx_course_activities_module_due (organization_id, course_id, module_id, due_at),
  ADD CONSTRAINT fk_course_activities_module FOREIGN KEY (organization_id, course_id, module_id)
    REFERENCES academic_course_modules (organization_id, course_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT;
