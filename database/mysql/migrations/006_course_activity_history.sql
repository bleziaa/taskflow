-- Historial auditable de cambios en actividades de cursos.
CREATE TABLE IF NOT EXISTS academic_course_activity_history (
  id CHAR(24) NOT NULL,
  organization_id CHAR(24) NOT NULL,
  course_id CHAR(24) NOT NULL,
  activity_id CHAR(24) NOT NULL,
  actor_user_id CHAR(24) NOT NULL,
  changed_fields JSON NOT NULL,
  before_values JSON NOT NULL,
  after_values JSON NOT NULL,
  changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_course_activity_history_activity (organization_id, course_id, activity_id, changed_at),
  KEY idx_course_activity_history_actor (organization_id, actor_user_id, changed_at),
  CONSTRAINT fk_course_activity_history_activity
    FOREIGN KEY (organization_id, activity_id)
    REFERENCES academic_course_activities (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_course_activity_history_course
    FOREIGN KEY (organization_id, course_id)
    REFERENCES academic_courses (organization_id, id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
