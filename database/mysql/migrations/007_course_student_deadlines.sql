-- Fecha límite excepcional por estudiante y actividad, sin alterar el vencimiento general.
CREATE TABLE IF NOT EXISTS academic_course_activity_student_deadlines (
  organization_id CHAR(24) NOT NULL,
  course_id CHAR(24) NOT NULL,
  activity_id CHAR(24) NOT NULL,
  student_id CHAR(24) NOT NULL,
  due_at DATETIME(3) NOT NULL,
  reason VARCHAR(500) NOT NULL DEFAULT '',
  updated_by_user_id CHAR(24) NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (organization_id, activity_id, student_id),
  KEY idx_student_deadlines_course (organization_id, course_id, student_id),
  CONSTRAINT fk_student_deadline_activity FOREIGN KEY (organization_id, activity_id)
    REFERENCES academic_course_activities (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_student_deadline_course FOREIGN KEY (organization_id, course_id)
    REFERENCES academic_courses (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_student_deadline_student FOREIGN KEY (organization_id, student_id)
    REFERENCES academic_students (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
