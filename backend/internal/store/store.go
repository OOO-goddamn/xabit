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

// ---------------------------------------------------------------- categories

func (s *Store) ListCategories(ctx context.Context, userID int64) ([]models.Category, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT c.id, c.name, COUNT(h.id)::int
		FROM categories c
		LEFT JOIN habits h ON h.category_id = c.id AND h.user_id = c.user_id
		WHERE c.user_id = $1
		GROUP BY c.id, c.name
		ORDER BY lower(c.name)`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]models.Category, 0)
	for rows.Next() {
		var category models.Category
		if err := rows.Scan(&category.ID, &category.Name, &category.HabitCount); err != nil {
			return nil, err
		}
		categories = append(categories, category)
	}

	return categories, rows.Err()
}

func (s *Store) CreateCategory(ctx context.Context, userID int64, name string) (models.Category, error) {
	category := models.Category{}
	err := s.pool.QueryRow(ctx,
		`INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING id, name`,
		userID, name,
	).Scan(&category.ID, &category.Name)
	if isPgCode(err, "23505") {
		return category, ErrConflict
	}
	return category, err
}

func (s *Store) UpdateCategory(ctx context.Context, userID, id int64, name string) (models.Category, error) {
	category := models.Category{ID: id, Name: name}
	err := s.pool.QueryRow(ctx,
		`UPDATE categories SET name = $3 WHERE id = $1 AND user_id = $2 RETURNING id, name`,
		id, userID, name,
	).Scan(&category.ID, &category.Name)
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
	SELECT h.id, h.name, h.description, h.category_id, c.name, h.created_at,
	       COALESCE(to_char(h.reminder_time, 'HH24:MI'), '')
	FROM habits h
	JOIN categories c ON c.id = h.category_id`

func (s *Store) ListHabits(ctx context.Context, userID int64, categoryID *int64) ([]models.Habit, error) {
	query := habitSelect + ` WHERE h.user_id = $1`
	args := []any{userID}

	if categoryID != nil {
		args = append(args, *categoryID)
		query += fmt.Sprintf(` AND h.category_id = $%d`, len(args))
	}
	query += ` ORDER BY lower(c.name), lower(h.name)`

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

func (s *Store) CreateHabit(ctx context.Context, userID int64, name, description string, categoryID int64, reminderTime string) (models.Habit, error) {
	var id int64
	err := s.pool.QueryRow(ctx, `
		INSERT INTO habits (user_id, name, description, category_id, reminder_time)
		SELECT $1, $2, $3, c.id, NULLIF($5, '')::time
		FROM categories c
		WHERE c.id = $4 AND c.user_id = $1
		RETURNING id`,
		userID, name, description, categoryID, reminderTime,
	).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Habit{}, ErrCategoryNotFound
	}
	if err != nil {
		return models.Habit{}, err
	}
	return s.GetHabit(ctx, userID, id)
}

func (s *Store) UpdateHabit(ctx context.Context, userID, id int64, name, description string, categoryID int64, reminderTime string) (models.Habit, error) {
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
		`UPDATE habits SET name = $3, description = $4, category_id = $5, reminder_time = NULLIF($6, '')::time WHERE id = $1 AND user_id = $2`,
		id, userID, name, description, categoryID, reminderTime,
	)
	if err != nil {
		return models.Habit{}, err
	}
	if tag.RowsAffected() == 0 {
		return models.Habit{}, ErrNotFound
	}
	return s.GetHabit(ctx, userID, id)
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

type habitRow interface {
	Scan(dest ...any) error
}

func scanHabit(row habitRow) (models.Habit, error) {
	var habit models.Habit
	err := row.Scan(
		&habit.ID,
		&habit.Name,
		&habit.Description,
		&habit.CategoryID,
		&habit.CategoryName,
		&habit.CreatedAt,
		&habit.ReminderTime,
	)
	return habit, err
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

	query := `SELECT c.id, c.habit_id, c.date, c.status, c.note
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

func (s *Store) UpsertCompletion(ctx context.Context, userID, habitID int64, date time.Time, status, note string) (models.Completion, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO habit_completions (habit_id, date, status, note)
		SELECT h.id, $2, $3, $4
		FROM habits h
		WHERE h.id = $1 AND h.user_id = $5
		ON CONFLICT (habit_id, date)
		DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note, updated_at = now()
		RETURNING id, habit_id, date, status, note`,
		habitID, date, status, note, userID,
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
		&completion.Note,
	)
	completion.Date = date.Format(time.DateOnly)

	return completion, err
}

func isPgCode(err error, code string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == code
}
