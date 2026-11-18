-- Matrícula administrada sin borrar entregas ni calificaciones.
CREATE TABLE IF NOT EXISTS academic_course_enrollment_history (
  id CHAR(24) NOT NULL,
  organization_id CHAR(24) NOT NULL,
  course_id CHAR(24) NOT NULL,
  student_id CHAR(24) NOT NULL,
  actor_user_id CHAR(24) NOT NULL,
  previous_status VARCHAR(16) NULL,
  new_status VARCHAR(16) NOT NULL,
  changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_enrollment_history (organization_id, course_id, student_id, changed_at),
  CONSTRAINT fk_enrollment_history_course FOREIGN KEY (organization_id, course_id)
    REFERENCES academic_courses (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_enrollment_history_student FOREIGN KEY (organization_id, student_id)
    REFERENCES academic_students (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
