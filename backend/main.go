package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

const (
	defaultJWTSecret = "dev-only-change-me"
	tokenTTL         = 7 * 24 * time.Hour
)

var (
	emailRegex = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
	hexRegex   = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)
)

type app struct {
	db        *sql.DB
	jwtSecret []byte
}

type materialSelection struct {
	ColorHex  string `json:"colorHex"`
	Finish    string `json:"finish"`
	PatternID string `json:"patternId"`
}

type catalogMaterial struct {
	Key    string `json:"key"`
	Name   string `json:"name"`
	Detail string `json:"detail"`
}

type catalogResponse struct {
	AllowedFinishes   []string          `json:"allowedFinishes"`
	AllowedPatternIDs []string          `json:"allowedPatternIds"`
	ID                string            `json:"id"`
	Materials         []catalogMaterial `json:"materials"`
	Name              string            `json:"name"`
}

type designRecord struct {
	CreatedAt  string                       `json:"createdAt"`
	ID         string                       `json:"id"`
	Materials  map[string]materialSelection `json:"selections"`
	Name       string                       `json:"name"`
	UpdatedAt  string                       `json:"updatedAt"`
	UserID     int64                        `json:"-"`
	DatabaseID int64                        `json:"-"`
}

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type designUpsertRequest struct {
	Name       string                       `json:"name"`
	Selections map[string]materialSelection `json:"selections"`
}

type userRecord struct {
	Email        string
	ID           int64
	PasswordHash string
}

type authClaims struct {
	Email string `json:"email"`
	jwt.RegisteredClaims
}

var defaultCatalog = catalogResponse{
	ID:   "tesla-cybertruck-low-poly",
	Name: "Tesla Cybertruck Low Poly",
	Materials: []catalogMaterial{
		{
			Key:    "material_1",
			Name:   "Hooks, Hitch & Mud Guards",
			Detail: "Tow hitch cover, front hooks, and tire splash guards",
		},
		{
			Key:    "material_3",
			Name:   "Glass Set",
			Detail: "Windshield, roof glass, and door glass",
		},
		{
			Key:    "material_5",
			Name:   "Window & Door Frames",
			Detail: "Trim and surrounding frame pieces",
		},
		{
			Key:    "material_6",
			Name:   "Cargo Bed",
			Detail: "Rear bed panel and inner bed walls",
		},
		{
			Key:    "material_7",
			Name:   "Wheel Covers",
			Detail: "Wheel cover face and trims",
		},
		{
			Key:    "material_8",
			Name:   "Tires",
			Detail: "Rubber tire material",
		},
		{
			Key:    "material_9",
			Name:   "Body Paint",
			Detail: "Main Tesla body panels",
		},
	},
	AllowedFinishes:   []string{"GLOSS", "MATTE"},
	AllowedPatternIDs: []string{"NONE", "PATTERN_1", "PATTERN_2", "PATTERN_3"},
}

func main() {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./design_your_tesla.db"
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	if err := initSchema(db); err != nil {
		log.Fatalf("init schema: %v", err)
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = defaultJWTSecret
	}

	application := &app{
		db:        db,
		jwtSecret: []byte(jwtSecret),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", application.handleHealth)
	mux.HandleFunc("POST /auth/register", application.handleRegister)
	mux.HandleFunc("POST /auth/login", application.handleLogin)
	mux.HandleFunc("GET /me", application.requireAuth(application.handleMe))
	mux.HandleFunc("GET /catalog/model", application.handleCatalog)
	mux.HandleFunc("POST /designs", application.requireAuth(application.handleCreateDesign))
	mux.HandleFunc("GET /designs", application.requireAuth(application.handleListDesigns))
	mux.HandleFunc("GET /designs/{id}", application.requireAuth(application.handleGetDesign))
	mux.HandleFunc("PUT /designs/{id}", application.requireAuth(application.handleUpdateDesign))

	addr := ":8080"
	log.Printf("backend listening on http://localhost%s", addr)

	server := &http.Server{
		Addr:              addr,
		Handler:           withCORS(mux),
		ReadHeaderTimeout: 10 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func initSchema(db *sql.DB) error {
	ddl := `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS designs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  selections_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_designs_user_id ON designs(user_id);
`

	_, err := db.Exec(ddl)
	return err
}

func (a *app) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *app) handleCatalog(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, defaultCatalog)
}

func (a *app) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON payload")
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	password := strings.TrimSpace(req.Password)
	if !emailRegex.MatchString(email) {
		writeError(w, http.StatusBadRequest, "email is invalid")
		return
	}
	if len(password) < 8 {
		writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "unable to hash password")
		return
	}

	createdAt := time.Now().UTC().Format(time.RFC3339)
	result, err := a.db.ExecContext(
		r.Context(),
		`INSERT INTO users(email, password_hash, created_at) VALUES (?, ?, ?)`,
		email,
		string(passwordHash),
		createdAt,
	)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			writeError(w, http.StatusConflict, "email already registered")
			return
		}
		writeError(w, http.StatusInternalServerError, "unable to register user")
		return
	}

	userID, err := result.LastInsertId()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "unable to register user")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{
		"id":        strconv.FormatInt(userID, 10),
		"email":     email,
		"createdAt": createdAt,
	})
}

func (a *app) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON payload")
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	if !emailRegex.MatchString(email) {
		writeError(w, http.StatusBadRequest, "email is invalid")
		return
	}

	user, err := a.findUserByEmail(r.Context(), email)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	token, err := a.signToken(user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "unable to create token")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"token": token})
}

func (a *app) handleMe(w http.ResponseWriter, r *http.Request, user userRecord) {
	writeJSON(w, http.StatusOK, map[string]string{
		"id":    strconv.FormatInt(user.ID, 10),
		"email": user.Email,
	})
}

func (a *app) handleCreateDesign(w http.ResponseWriter, r *http.Request, user userRecord) {
	var req designUpsertRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON payload")
		return
	}

	selections, err := validateSelections(req.Selections)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = fmt.Sprintf("Design %d", time.Now().UTC().Unix())
	}

	selectionsJSON, err := json.Marshal(selections)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "unable to encode design selections")
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	result, err := a.db.ExecContext(
		r.Context(),
		`INSERT INTO designs(user_id, name, selections_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
		user.ID,
		name,
		string(selectionsJSON),
		now,
		now,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "unable to save design")
		return
	}

	insertID, err := result.LastInsertId()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "unable to save design")
		return
	}

	record := designRecord{
		CreatedAt: now,
		ID:        strconv.FormatInt(insertID, 10),
		Materials: selections,
		Name:      name,
		UpdatedAt: now,
	}
	writeJSON(w, http.StatusCreated, record)
}

func (a *app) handleListDesigns(w http.ResponseWriter, r *http.Request, user userRecord) {
	rows, err := a.db.QueryContext(
		r.Context(),
		`SELECT id, name, selections_json, created_at, updated_at FROM designs WHERE user_id = ? ORDER BY created_at DESC`,
		user.ID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "unable to load designs")
		return
	}
	defer rows.Close()

	designs := make([]designRecord, 0)
	for rows.Next() {
		var (
			id             int64
			name           string
			selectionsJSON string
			createdAt      string
			updatedAt      string
		)

		if err := rows.Scan(&id, &name, &selectionsJSON, &createdAt, &updatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "unable to load designs")
			return
		}

		selections := map[string]materialSelection{}
		if err := json.Unmarshal([]byte(selectionsJSON), &selections); err != nil {
			writeError(w, http.StatusInternalServerError, "corrupt design data")
			return
		}

		designs = append(designs, designRecord{
			CreatedAt: createdAt,
			ID:        strconv.FormatInt(id, 10),
			Materials: selections,
			Name:      name,
			UpdatedAt: updatedAt,
		})
	}

	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "unable to load designs")
		return
	}

	writeJSON(w, http.StatusOK, map[string][]designRecord{
		"designs": designs,
	})
}

func (a *app) handleGetDesign(w http.ResponseWriter, r *http.Request, user userRecord) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "design id is invalid")
		return
	}

	record, err := a.findDesignByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "design not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "unable to load design")
		return
	}

	if record.UserID != user.ID {
		writeError(w, http.StatusNotFound, "design not found")
		return
	}

	writeJSON(w, http.StatusOK, record)
}

func (a *app) handleUpdateDesign(w http.ResponseWriter, r *http.Request, user userRecord) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "design id is invalid")
		return
	}

	existing, err := a.findDesignByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "design not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "unable to load design")
		return
	}

	if existing.UserID != user.ID {
		writeError(w, http.StatusNotFound, "design not found")
		return
	}

	var req designUpsertRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON payload")
		return
	}

	selections, err := validateSelections(req.Selections)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = existing.Name
	}

	selectionsJSON, err := json.Marshal(selections)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "unable to encode design selections")
		return
	}

	updatedAt := time.Now().UTC().Format(time.RFC3339)
	_, err = a.db.ExecContext(
		r.Context(),
		`UPDATE designs SET name = ?, selections_json = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
		name,
		string(selectionsJSON),
		updatedAt,
		id,
		user.ID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "unable to update design")
		return
	}

	writeJSON(w, http.StatusOK, designRecord{
		CreatedAt: existing.CreatedAt,
		ID:        strconv.FormatInt(id, 10),
		Materials: selections,
		Name:      name,
		UpdatedAt: updatedAt,
	})
}

func (a *app) findDesignByID(ctx context.Context, id int64) (designRecord, error) {
	var (
		record         designRecord
		userID         int64
		designName     string
		selectionsJSON string
		createdAt      string
		updatedAt      string
	)

	err := a.db.QueryRowContext(
		ctx,
		`SELECT id, user_id, name, selections_json, created_at, updated_at FROM designs WHERE id = ?`,
		id,
	).Scan(&record.DatabaseID, &userID, &designName, &selectionsJSON, &createdAt, &updatedAt)
	if err != nil {
		return designRecord{}, err
	}

	selections := map[string]materialSelection{}
	if err := json.Unmarshal([]byte(selectionsJSON), &selections); err != nil {
		return designRecord{}, err
	}

	record.CreatedAt = createdAt
	record.ID = strconv.FormatInt(id, 10)
	record.Materials = selections
	record.Name = designName
	record.UpdatedAt = updatedAt
	record.UserID = userID
	return record, nil
}

func (a *app) requireAuth(
	next func(http.ResponseWriter, *http.Request, userRecord),
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, err := a.userFromRequest(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next(w, r, user)
	}
}

func (a *app) userFromRequest(r *http.Request) (userRecord, error) {
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if authHeader == "" {
		return userRecord{}, errors.New("missing authorization header")
	}

	const bearerPrefix = "Bearer "
	if !strings.HasPrefix(authHeader, bearerPrefix) {
		return userRecord{}, errors.New("invalid authorization header")
	}
	tokenString := strings.TrimSpace(strings.TrimPrefix(authHeader, bearerPrefix))
	if tokenString == "" {
		return userRecord{}, errors.New("invalid authorization header")
	}

	token, err := jwt.ParseWithClaims(tokenString, &authClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return a.jwtSecret, nil
	})
	if err != nil {
		return userRecord{}, err
	}

	claims, ok := token.Claims.(*authClaims)
	if !ok || !token.Valid {
		return userRecord{}, errors.New("invalid token")
	}

	userID, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil || userID <= 0 {
		return userRecord{}, errors.New("invalid token subject")
	}

	user, err := a.findUserByID(r.Context(), userID)
	if err != nil {
		return userRecord{}, err
	}
	return user, nil
}

func (a *app) signToken(user userRecord) (string, error) {
	now := time.Now().UTC()
	claims := authClaims{
		Email: user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(tokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   strconv.FormatInt(user.ID, 10),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(a.jwtSecret)
}

func (a *app) findUserByEmail(ctx context.Context, email string) (userRecord, error) {
	var user userRecord
	err := a.db.QueryRowContext(
		ctx,
		`SELECT id, email, password_hash FROM users WHERE email = ?`,
		email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash)
	if err != nil {
		return userRecord{}, err
	}
	return user, nil
}

func (a *app) findUserByID(ctx context.Context, userID int64) (userRecord, error) {
	var user userRecord
	err := a.db.QueryRowContext(
		ctx,
		`SELECT id, email, password_hash FROM users WHERE id = ?`,
		userID,
	).Scan(&user.ID, &user.Email, &user.PasswordHash)
	if err != nil {
		return userRecord{}, err
	}
	return user, nil
}

func validateSelections(
	selections map[string]materialSelection,
) (map[string]materialSelection, error) {
	if len(selections) == 0 {
		return nil, errors.New("selections must include at least one material")
	}

	allowedMaterialKeys := map[string]bool{}
	for _, item := range defaultCatalog.Materials {
		allowedMaterialKeys[item.Key] = true
	}

	allowedFinishes := map[string]bool{}
	for _, finish := range defaultCatalog.AllowedFinishes {
		allowedFinishes[finish] = true
	}

	allowedPatterns := map[string]bool{}
	for _, pattern := range defaultCatalog.AllowedPatternIDs {
		allowedPatterns[pattern] = true
	}

	validated := make(map[string]materialSelection, len(selections))
	for key, value := range selections {
		if !allowedMaterialKeys[key] {
			return nil, fmt.Errorf("material key %q is not allowed", key)
		}

		color := strings.ToUpper(strings.TrimSpace(value.ColorHex))
		if !hexRegex.MatchString(color) {
			return nil, fmt.Errorf("material %q has invalid colorHex", key)
		}
		if !allowedFinishes[value.Finish] {
			return nil, fmt.Errorf("material %q has invalid finish", key)
		}
		if !allowedPatterns[value.PatternID] {
			return nil, fmt.Errorf("material %q has invalid patternId", key)
		}

		validated[key] = materialSelection{
			ColorHex:  color,
			Finish:    value.Finish,
			PatternID: value.PatternID,
		}
	}

	return validated, nil
}

func decodeJSON(r *http.Request, target interface{}) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
