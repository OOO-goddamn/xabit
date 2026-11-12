// Command seed fills the database with demo categories, habits and completions.
//
//	go run ./cmd/seed          # only when the database has no habits yet
//	go run ./cmd/seed -force   # wipe demo data first
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"math/rand"
	"os"
	"time"

	"github.com/joho/godotenv"

	"habit/backend/internal/auth"
	"habit/backend/internal/config"
	"habit/backend/internal/database"
)

const (
	demoEmail    = "demo@habit.local"
	demoPassword = "habit12345"
	demoName     = "Демо-пользователь"
)

type demoHabit struct {
	name        string
	description string
	category    string
	doneChance  float64
	target      int
	unit        string
	step        int
}

func main() {
	force := flag.Bool("force", false, "delete existing data before seeding")
	flag.Parse()

	_ = godotenv.Load()

	cfg := config.Load()
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	ctx := context.Background()

	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := database.Migrate(ctx, pool); err != nil {
		logger.Error("migrations failed", "error", err)
		os.Exit(1)
	}

	var habitCount int
	if err := pool.QueryRow(ctx, "SELECT COUNT(*)::int FROM habits").Scan(&habitCount); err != nil {
		logger.Error("count habits failed", "error", err)
		os.Exit(1)
	}

	if habitCount > 0 && !*force {
		logger.Info("database already contains habits, nothing to do", "hint", "run with -force to reseed")
		return
	}

	if *force {
		if _, err := pool.Exec(ctx, "TRUNCATE categories RESTART IDENTITY CASCADE"); err != nil {
			logger.Error("truncate failed", "error", err)
			os.Exit(1)
		}
	}

	passwordHash, err := auth.HashPassword(demoPassword)
	if err != nil {
		logger.Error("hash demo password failed", "error", err)
		os.Exit(1)
	}

	var userID int64
	if err := pool.QueryRow(ctx, `
		INSERT INTO users (email, name, password_hash)
		VALUES ($1, $2, $3)
		ON CONFLICT (lower(email)) DO UPDATE SET name = EXCLUDED.name
		RETURNING id`,
		demoEmail, demoName, passwordHash,
	).Scan(&userID); err != nil {
		logger.Error("create demo user failed", "error", err)
		os.Exit(1)
	}

	categories := []string{"Здоровье", "Продуктивность", "Обучение", "Отдых"}
	categoryIDs := make(map[string]int64, len(categories))

	for _, name := range categories {
		var id int64
		if err := pool.QueryRow(ctx,
			`INSERT INTO categories (user_id, name) VALUES ($1, $2)
			 ON CONFLICT (user_id, lower(name)) DO UPDATE SET name = EXCLUDED.name
			 RETURNING id`, userID, name,
		).Scan(&id); err != nil {
			logger.Error("create category failed", "error", err, "category", name)
			os.Exit(1)
		}
		categoryIDs[name] = id
	}

	habits := []demoHabit{
		{"Зарядка 15 минут", "Лёгкая разминка и растяжка сразу после пробуждения", "Здоровье", 0.72, 15, "мин", 5},
		{"Два литра воды", "Держать бутылку на рабочем столе и отмечать каждый стакан", "Здоровье", 0.85, 2000, "мл", 250},
		{"Прогулка 8000 шагов", "Вечерний круг по парку вместо дороги домой на автобусе", "Здоровье", 0.65, 8000, "шаг", 1000},
		{"Час глубокой работы", "Без уведомлений и переключений на почту и мессенджеры", "Продуктивность", 0.6, 60, "мин", 15},
		{"План на следующий день", "Пять минут вечером, чтобы расставить три главных приоритета", "Продуктивность", 0.78, 0, "", 0},
		{"Читать 20 страниц", "Художественная литература или нон-фикшн — на выбор", "Обучение", 0.7, 20, "стр", 5},
		{"Урок английского", "Пятнадцать минут практики в приложении", "Обучение", 0.58, 15, "мин", 5},
		{"Медитация 10 минут", "Тишина, дыхание и ни одного уведомления рядом", "Отдых", 0.5, 10, "мин", 5},
		{"Без экрана за час до сна", "Телефон остаётся на кухне, а на тумбочке — книга", "Отдых", 0.45, 0, "", 0},
	}

	habitIDs := make([]int64, 0, len(habits))
	for _, habit := range habits {
		var id int64
		step := habit.step
		if step <= 0 {
			step = 1
		}
		if err := pool.QueryRow(ctx, `
			INSERT INTO habits (user_id, name, description, category_id, target_value, unit, step_value)
			VALUES ($1, $2, $3, $4, NULLIF($5, 0), $6, $7) RETURNING id`,
			userID, habit.name, habit.description, categoryIDs[habit.category],
			habit.target, habit.unit, step,
		).Scan(&id); err != nil {
			logger.Error("create habit failed", "error", err, "habit", habit.name)
			os.Exit(1)
		}
		habitIDs = append(habitIDs, id)
	}

	random := rand.New(rand.NewSource(20261104))
	now := time.Now()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

	notes := map[string][]string{
		"done": {
			"Сделал с утра, пока были силы",
			"Было лень, но всё же начал",
			"Короткая версия — лучше, чем ничего",
			"Отложил на вечер и успел",
			"Сегодня далось особенно легко",
		},
		"skipped": {
			"Не хватило времени из-за работы",
			"Проспал, переношу на завтра",
			"Было плохое самочувствие",
		},
		"progress": {
			"Сделал часть — уже неплохо",
			"Не дотянул до цели, но начал",
			"Половина пути пройдена",
		},
	}

	inserted := 0
	for dayOffset := 19; dayOffset >= 0; dayOffset-- {
		date := start.AddDate(0, 0, -dayOffset)
		for index, habit := range habits {
			if dayOffset == 0 && index%3 == 0 {
				continue // leave a few habits open for today
			}

			roll := random.Float64()
			status := "done"
			value := 0
			switch {
			case roll < habit.doneChance:
				status = "done"
				value = habit.target
			case roll < habit.doneChance+0.1 && habit.target > 1:
				status = "progress"
				value = 1 + random.Intn(habit.target-1)
			case roll < habit.doneChance+0.2:
				status = "skipped"
			default:
				continue
			}

			note := ""
			if random.Float64() < 0.14 {
				options := notes[status]
				if len(options) > 0 {
					note = options[random.Intn(len(options))]
				}
			}

			if _, err := pool.Exec(ctx, `
				INSERT INTO habit_completions (habit_id, date, status, value, note)
				VALUES ($1, $2, $3, $4, $5)
				ON CONFLICT (habit_id, date) DO NOTHING`,
				habitIDs[index], date, status, value, note,
			); err != nil {
				logger.Error("create completion failed", "error", err)
				os.Exit(1)
			}
			inserted++
		}
	}

	fmt.Printf("Seeded %d categories, %d habits and %d completions.\n", len(categories), len(habits), inserted)
	fmt.Printf("Demo login: %s / %s\n", demoEmail, demoPassword)
}
