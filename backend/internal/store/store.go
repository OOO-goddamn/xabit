package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"habit/backend/internal/models"
)

var (
	ErrNotFound         = errors.New("not found")
	ErrConflict         = errors.New("conflict")
	ErrEmailTaken       = errors.New("email taken")
	ErrCategoryInUse    = errors.New("category in use")
	ErrCategoryNotFound = errors.New("category not found")
	ErrHabitNotFound    = errors.New("habit not found")
	ErrInvalidOrder     = errors.New("invalid item order")
)

type Store struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// --------------------------------------------------------------------- users

const userSelect = `SELECT id, email, name, password_hash, created_at FROM users`

func (s *Store) CreateUser(ctx context.Context, email, name, passwordHash string) (models.User, error) {
	var user models.User
	err := s.pool.QueryRow(ctx,
		`INSERT INTO users (email, name, password_hash)
		 VALUES ($1, $2, $3)
		 RETURNING id, email, name, password_hash, created_at`,
		email, name, passwordHash,
	).Scan(&user.ID, &user.Email, &user.Name, &user.PasswordHash, &user.CreatedAt)
	if isPgCode(err, "23505") {
		return user, ErrEmailTaken
	}
	return user, err
}

func (s *Store) UserByEmail(ctx context.Context, email string) (models.User, error) {
	var user models.User
	err := s.pool.QueryRow(ctx,
		userSelect+` WHERE lower(email) = lower($1)`, email,
	).Scan(&user.ID, &user.Email, &user.Name, &user.PasswordHash, &user.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return user, ErrNotFound
	}
	return user, err
}

func (s *Store) UserByID(ctx context.Context, id int64) (models.User, error) {
	var user models.User
	err := s.pool.QueryRow(ctx,
		userSelect+` WHERE id = $1`, id,
	).Scan(&user.ID, &user.Email, &user.Name, &user.PasswordHash, &user.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return user, ErrNotFound
	}
	return user, err
}

func (s *Store) CreateSession(ctx context.Context, userID int64, tokenHash string, expiresAt time.Time) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
		userID, tokenHash, expiresAt,
	)
	return err
}

func (s *Store) UserBySessionToken(ctx context.Context, tokenHash string, now time.Time) (models.User, error) {
	var user models.User
	err := s.pool.QueryRow(ctx, `
		SELECT u.id, u.email, u.name, u.password_hash, u.created_at
		FROM sessions s
		JOIN users u ON u.id = s.user_id
		WHERE s.token_hash = $1 AND s.expires_at > $2`,
		tokenHash, now,
	).Scan(&user.ID, &user.Email, &user.Name, &user.PasswordHash, &user.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return user, ErrNotFound
	}
	return user, err
}

func (s *Store) DeleteSession(ctx context.Context, tokenHash string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE token_hash = $1`, tokenHash)
	return err
}

// ------------------------------------------------------------------- feedback

type Feedback struct {
	ID        int64     `json:"id"`
	UserEmail string    `json:"userEmail"`
	Kind      string    `json:"kind"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"createdAt"`
}

func (s *Store) CreateFeedback(ctx context.Context, userID int64, kind, message string) (int64, time.Time, error) {
	var id int64
	var createdAt time.Time
	err := s.pool.QueryRow(ctx,
		`INSERT INTO feedback (user_id, kind, message) VALUES ($1, $2, $3) RETURNING id, created_at`,
		userID, kind, message,
	).Scan(&id, &createdAt)
	return id, createdAt, err
}

func (s *Store) ListFeedback(ctx context.Context, limit int) ([]Feedback, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT f.id, u.email, f.kind, f.message, f.created_at
		FROM feedback f
		JOIN users u ON u.id = f.user_id
		ORDER BY f.created_at DESC, f.id DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Feedback, 0)
	for rows.Next() {
		var item Feedback
		if err := rows.Scan(&item.ID, &item.UserEmail, &item.Kind, &item.Message, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// ---------------------------------------------------------------- categories

func (s *Store) ListCategories(ctx context.Context, userID int64) ([]models.Category, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT c.id, c.name, c.icon, c.color, COUNT(h.id)::int
		FROM categories c
		LEFT JOIN habits h ON h.category_id = c.id AND h.user_id = c.user_id
		WHERE c.user_id = $1
		GROUP BY c.id, c.name, c.icon, c.color
		ORDER BY c.sort_order, lower(c.name)`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]models.Category, 0)
	for rows.Next() {
		var category models.Category
		if err := rows.Scan(&category.ID, &category.Name, &category.Icon, &category.Color, &category.HabitCount); err != nil {
			return nil, err
		}
		categories = append(categories, category)
	}

	return categories, rows.Err()
}

func (s *Store) CreateCategory(ctx context.Context, userID int64, name, icon, color string) (models.Category, error) {
	category := models.Category{}
	err := s.pool.QueryRow(ctx,
		`INSERT INTO categories (user_id, name, icon, color, sort_order)
		 SELECT $1, $2, $3, $4, COALESCE(MAX(sort_order) + 1, 0)
		 FROM categories WHERE user_id = $1
		 RETURNING id, name, icon, color`,
		userID, name, icon, color,
	).Scan(&category.ID, &category.Name, &category.Icon, &category.Color)
	if isPgCode(err, "23505") {
		return category, ErrConflict
	}
	return category, err
}

func (s *Store) ReorderCategories(ctx context.Context, userID int64, ids []int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var count int
	if err := tx.QueryRow(ctx, `SELECT COUNT(*)::int FROM categories WHERE user_id = $1`, userID).Scan(&count); err != nil {
		return err
	}
	if count != len(ids) {
		return ErrInvalidOrder
	}

	for position, id := range ids {
		tag, err := tx.Exec(ctx, `UPDATE categories SET sort_order = $3 WHERE id = $1 AND user_id = $2`, id, userID, position)
		if err != nil {
			return err
		}
		if tag.RowsAffected() != 1 {
			return ErrInvalidOrder
		}
	}
	return tx.Commit(ctx)
}

func (s *Store) UpdateCategory(ctx context.Context, userID, id int64, name, icon, color string) (models.Category, error) {
	category := models.Category{ID: id, Name: name}
	err := s.pool.QueryRow(ctx,
		`UPDATE categories
		 SET name = $3, icon = COALESCE(NULLIF($4, ''), icon), color = COALESCE(NULLIF($5, ''), color)
		 WHERE id = $1 AND user_id = $2
		 RETURNING id, name, icon, color`,
		id, userID, name, icon, color,
	).Scan(&category.ID, &category.Name, &category.Icon, &category.Color)
	if errors.Is(err, pgx.ErrNoRows) {
		return category, ErrNotFound
	}
	if isPgCode(err, "23505") {
		return category, ErrConflict
	}
	if err != nil {
		return category, err
	}

	if err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*)::int FROM habits WHERE category_id = $1 AND user_id = $2`, id, userID,
	).Scan(&category.HabitCount); err != nil {
		return category, err
	}

	return category, nil
}

func (s *Store) DeleteCategory(ctx context.Context, userID, id int64) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM categories WHERE id = $1 AND user_id = $2`, id, userID)
	if isPgCode(err, "23503") {
		return ErrCategoryInUse
	}
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// -------------------------------------------------------------------- habits

const habitSelect = `
	SELECT h.id, h.name, h.description, h.category_id, c.name, c.icon, c.color, h.created_at,
	       COALESCE(to_char(h.reminder_time, 'HH24:MI'), ''),
	       h.repeat_type, h.weekdays, COALESCE(h.month_day, 0),
	       COALESCE(h.target_value, 0), h.unit, COALESCE(h.step_value, 1)
	FROM habits h
	JOIN categories c ON c.id = h.category_id`

func (s *Store) ListHabits(ctx context.Context, userID int64, categoryID *int64) ([]models.Habit, error) {
	query := habitSelect + ` WHERE h.user_id = $1`
	args := []any{userID}

	if categoryID != nil {
		args = append(args, *categoryID)
		query += fmt.Sprintf(` AND h.category_id = $%d`, len(args))
	}
	query += ` ORDER BY c.sort_order, h.sort_order, lower(c.name), lower(h.name)`

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	habits := make([]models.Habit, 0)
	for rows.Next() {
		habit, err := scanHabit(rows)
		if err != nil {
			return nil, err
		}
		habits = append(habits, habit)
	}

	return habits, rows.Err()
}

func (s *Store) GetHabit(ctx context.Context, userID, id int64) (models.Habit, error) {
	row := s.pool.QueryRow(ctx, habitSelect+` WHERE h.id = $1 AND h.user_id = $2`, id, userID)
	habit, err := scanHabit(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return habit, ErrNotFound
	}
	return habit, err
}

func (s *Store) CreateHabit(ctx context.Context, userID int64, name, description string, categoryID int64, reminderTime string, schedule models.Schedule, targetValue *int, unit string, stepValue int) (models.Habit, error) {
	var id int64
	err := s.pool.QueryRow(ctx, `
		INSERT INTO habits (user_id, name, description, category_id, reminder_time, repeat_type, weekdays, month_day, target_value, unit, step_value, sort_order)
		SELECT $1, $2, $3, c.id, NULLIF($5, '')::time, $6, $7, $8, $9, $10, $11,
		       COALESCE((SELECT MAX(existing.sort_order) + 1 FROM habits existing WHERE existing.user_id = $1 AND existing.category_id = c.id), 0)
		FROM categories c
		WHERE c.id = $4 AND c.user_id = $1
		RETURNING id`,
		userID, name, description, categoryID, reminderTime,
		schedule.Repeat, weekdayParams(schedule.Weekdays), monthDayParam(schedule.MonthDay),
		targetValue, unit, stepValue,
	).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Habit{}, ErrCategoryNotFound
	}
	if err != nil {
		return models.Habit{}, err
	}
	return s.GetHabit(ctx, userID, id)
}

func (s *Store) UpdateHabit(ctx context.Context, userID, id int64, name, description string, categoryID int64, reminderTime string, schedule models.Schedule, targetValue *int, unit string, stepValue int) (models.Habit, error) {
	var categoryExists bool
	if err := s.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM categories WHERE id = $1 AND user_id = $2)`,
		categoryID, userID,
	).Scan(&categoryExists); err != nil {
		return models.Habit{}, err
	}
	if !categoryExists {
		return models.Habit{}, ErrCategoryNotFound
	}

	tag, err := s.pool.Exec(ctx,
		`UPDATE habits
		 SET name = $3, description = $4,
		     sort_order = CASE WHEN category_id <> $5 THEN
		         COALESCE((SELECT MAX(existing.sort_order) + 1 FROM habits existing WHERE existing.user_id = $2 AND existing.category_id = $5), 0)
		     ELSE sort_order END,
		     category_id = $5, reminder_time = NULLIF($6, '')::time,
		     repeat_type = $7, weekdays = $8, month_day = $9,
		     target_value = $10, unit = $11, step_value = $12
		 WHERE id = $1 AND user_id = $2`,
		id, userID, name, description, categoryID, reminderTime,
		schedule.Repeat, weekdayParams(schedule.Weekdays), monthDayParam(schedule.MonthDay),
		targetValue, unit, stepValue,
	)
	if err != nil {
		return models.Habit{}, err
	}
	if tag.RowsAffected() == 0 {
		return models.Habit{}, ErrNotFound
	}

	// Turning a quantity habit back into a binary one must not leave
	// "progress" rows that no longer make sense. Such days were not completed,
	// so they become skipped rather than retroactively done.
	if targetValue == nil {
		if _, err := s.pool.Exec(ctx,
			`UPDATE habit_completions SET status = 'skipped', value = 0, updated_at = now()
			 WHERE habit_id = $1 AND status = 'progress'`, id,
		); err != nil {
			return models.Habit{}, err
		}
	}

	return s.GetHabit(ctx, userID, id)
}

func (s *Store) ReorderHabits(ctx context.Context, userID, categoryID int64, ids []int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var count int
	if err := tx.QueryRow(ctx,
		`SELECT COUNT(*)::int FROM habits WHERE user_id = $1 AND category_id = $2`, userID, categoryID,
	).Scan(&count); err != nil {
		return err
	}
	if count != len(ids) {
		return ErrInvalidOrder
	}

	for position, id := range ids {
		tag, err := tx.Exec(ctx,
			`UPDATE habits SET sort_order = $4 WHERE id = $1 AND user_id = $2 AND category_id = $3`,
			id, userID, categoryID, position,
		)
		if err != nil {
			return err
		}
		if tag.RowsAffected() != 1 {
			return ErrInvalidOrder
		}
	}
	return tx.Commit(ctx)
}

func (s *Store) DeleteHabit(ctx context.Context, userID, id int64) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM habits WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// --------------------------------------------------------------------- tasks

const taskSelect = `
	SELECT id, title, note, priority, due_date, done, created_at
	FROM tasks`

func (s *Store) ListTasks(ctx context.Context, userID int64) ([]models.Task, error) {
	rows, err := s.pool.Query(ctx,
		taskSelect+` WHERE user_id = $1 ORDER BY done, sort_order, id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := make([]models.Task, 0)
	for rows.Next() {
		task, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, rows.Err()
}

// ListTasksForDate returns unfinished tasks for the given day. Undated tasks
// are included only for today: they are the user's backlog and would look
// out of place on a day in the past.
func (s *Store) ListTasksForDate(ctx context.Context, userID int64, date time.Time, includeUndated bool) ([]models.Task, error) {
	query := taskSelect + ` WHERE user_id = $1 AND NOT done AND (due_date = $2`
	args := []any{userID, date}
	if includeUndated {
		query += ` OR due_date IS NULL`
	}
	query += `) ORDER BY sort_order, id`

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := make([]models.Task, 0)
	for rows.Next() {
		task, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, rows.Err()
}

func (s *Store) CreateTask(ctx context.Context, userID int64, title, note, priority string, dueDate *time.Time) (models.Task, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO tasks (user_id, title, note, priority, due_date, sort_order)
		VALUES ($1, $2, $3, $4, $5,
		        COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE user_id = $1), 0))
		RETURNING id, title, note, priority, due_date, done, created_at`,
		userID, title, note, priority, dueDate)
	return scanTask(row)
}

// UpdateTask replaces the editable fields. The client always sends the full
// task, so a nil dueDate reliably means "no date".
func (s *Store) UpdateTask(ctx context.Context, userID, id int64, title, note, priority string, dueDate *time.Time, done bool) (models.Task, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE tasks
		SET title = $3, note = $4, priority = $5, due_date = $6, done = $7,
		    completed_at = CASE WHEN $7 THEN COALESCE(completed_at, now()) ELSE NULL END
		WHERE id = $1 AND user_id = $2
		RETURNING id, title, note, priority, due_date, done, created_at`,
		id, userID, title, note, priority, dueDate, done)

	task, err := scanTask(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return task, ErrNotFound
	}
	return task, err
}

func (s *Store) DeleteTask(ctx context.Context, userID, id int64) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM tasks WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ReorderTasks assigns sort_order by the given sequence. Only the listed tasks
// are touched, so separate groups (today, undated, later) can be reordered
// independently.
func (s *Store) ReorderTasks(ctx context.Context, userID int64, ids []int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for position, id := range ids {
		tag, err := tx.Exec(ctx,
			`UPDATE tasks SET sort_order = $3 WHERE id = $1 AND user_id = $2`,
			id, userID, position,
		)
		if err != nil {
			return err
		}
		if tag.RowsAffected() != 1 {
			return ErrInvalidOrder
		}
	}
	return tx.Commit(ctx)
}

func scanTask(row habitRow) (models.Task, error) {
	var task models.Task
	var dueDate *time.Time

	err := row.Scan(&task.ID, &task.Title, &task.Note, &task.Priority, &dueDate, &task.Done, &task.CreatedAt)
	if dueDate != nil {
		formatted := dueDate.Format(time.DateOnly)
		task.DueDate = &formatted
	}
	return task, err
}

type habitRow interface {
	Scan(dest ...any) error
}

func scanHabit(row habitRow) (models.Habit, error) {
	var habit models.Habit
	var weekdays []int32
	var monthDay int
	var targetValue int

	err := row.Scan(
		&habit.ID,
		&habit.Name,
		&habit.Description,
		&habit.CategoryID,
		&habit.CategoryName,
		&habit.CategoryIcon,
		&habit.CategoryColor,
		&habit.CreatedAt,
		&habit.ReminderTime,
		&habit.Schedule.Repeat,
		&weekdays,
		&monthDay,
		&targetValue,
		&habit.Unit,
		&habit.StepValue,
	)
	if err != nil {
		return habit, err
	}

	habit.Schedule.Weekdays = weekdaysToInts(weekdays)
	if monthDay > 0 {
		habit.Schedule.MonthDay = &monthDay
	}
	if targetValue > 0 {
		habit.TargetValue = &targetValue
	}
	return habit, nil
}

func weekdayParams(days []int) []int32 {
	params := make([]int32, len(days))
	for index, day := range days {
		params[index] = int32(day)
	}
	return params
}

func weekdaysToInts(days []int32) []int {
	result := make([]int, len(days))
	for index, day := range days {
		result[index] = int(day)
	}
	return result
}

func monthDayParam(day *int) any {
	if day == nil {
		return nil
	}
	return *day
}

// --------------------------------------------------------------- completions

type CompletionFilter struct {
	UserID  int64
	HabitID *int64
	From    *time.Time
	To      *time.Time
}

func (s *Store) ListCompletions(ctx context.Context, filter CompletionFilter) ([]models.Completion, error) {
	conditions := make([]string, 0, 4)
	args := []any{filter.UserID}
	conditions = append(conditions, `h.user_id = $1`)

	if filter.HabitID != nil {
		args = append(args, *filter.HabitID)
		conditions = append(conditions, fmt.Sprintf("c.habit_id = $%d", len(args)))
	}
	if filter.From != nil {
		args = append(args, *filter.From)
		conditions = append(conditions, fmt.Sprintf("c.date >= $%d", len(args)))
	}
	if filter.To != nil {
		args = append(args, *filter.To)
		conditions = append(conditions, fmt.Sprintf("c.date <= $%d", len(args)))
	}

	query := `SELECT c.id, c.habit_id, c.date, c.status, c.value, c.note
		FROM habit_completions c
		JOIN habits h ON h.id = c.habit_id
		WHERE ` + strings.Join(conditions, " AND ")
	query += " ORDER BY c.date DESC, c.id DESC"

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	completions := make([]models.Completion, 0)
	for rows.Next() {
		completion, err := scanCompletion(rows)
		if err != nil {
			return nil, err
		}
		completions = append(completions, completion)
	}

	return completions, rows.Err()
}

func (s *Store) UpsertCompletion(ctx context.Context, userID, habitID int64, date time.Time, status string, value int, note string) (models.Completion, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO habit_completions (habit_id, date, status, value, note)
		SELECT h.id, $2, $3, $4, $5
		FROM habits h
		WHERE h.id = $1 AND h.user_id = $6
		ON CONFLICT (habit_id, date)
		DO UPDATE SET status = EXCLUDED.status, value = EXCLUDED.value, note = EXCLUDED.note, updated_at = now()
		RETURNING id, habit_id, date, status, value, note`,
		habitID, date, status, value, note, userID,
	)

	completion, err := scanCompletion(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return completion, ErrHabitNotFound
	}
	return completion, err
}

func (s *Store) DeleteCompletion(ctx context.Context, userID, habitID int64, date time.Time) error {
	tag, err := s.pool.Exec(ctx, `
		DELETE FROM habit_completions c
		USING habits h
		WHERE c.habit_id = $1
		  AND c.date = $2
		  AND h.id = c.habit_id
		  AND h.user_id = $3`,
		habitID, date, userID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListDoneDates returns every completed day grouped by habit. Used for streaks.
func (s *Store) ListDoneDates(ctx context.Context, userID int64) (map[int64][]time.Time, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT c.habit_id, c.date
		FROM habit_completions c
		JOIN habits h ON h.id = c.habit_id
		WHERE c.status = 'done' AND h.user_id = $1
		ORDER BY c.habit_id, c.date`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[int64][]time.Time)
	for rows.Next() {
		var habitID int64
		var date time.Time
		if err := rows.Scan(&habitID, &date); err != nil {
			return nil, err
		}
		result[habitID] = append(result[habitID], date)
	}

	return result, rows.Err()
}

func scanCompletion(row habitRow) (models.Completion, error) {
	var completion models.Completion
	var date time.Time

	err := row.Scan(
		&completion.ID,
		&completion.HabitID,
		&date,
		&completion.Status,
		&completion.Value,
		&completion.Note,
	)
	completion.Date = date.Format(time.DateOnly)

	return completion, err
}

func isPgCode(err error, code string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == code
}
