// Package auth contains password hashing and session token helpers.
//
// Passwords are stored as PBKDF2-HMAC-SHA256 hashes with a per-user random
// salt. The format is self-describing so the iteration count can be raised
// later without invalidating existing hashes.
package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

const (
	hashAlgorithm  = "pbkdf2_sha256"
	hashIterations = 210_000
	saltLength     = 16
	keyLength      = 32
)

// HashPassword returns a salted PBKDF2 hash in the form
// pbkdf2_sha256$iterations$salt$key (salt and key are base64url encoded).
func HashPassword(password string) (string, error) {
	salt := make([]byte, saltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate salt: %w", err)
	}

	key := pbkdf2SHA256([]byte(password), salt, hashIterations, keyLength)

	return fmt.Sprintf(
		"%s$%d$%s$%s",
		hashAlgorithm,
		hashIterations,
		base64.RawURLEncoding.EncodeToString(salt),
		base64.RawURLEncoding.EncodeToString(key),
	), nil
}

// VerifyPassword compares a plaintext password with a stored hash.
func VerifyPassword(encoded, password string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 4 || parts[0] != hashAlgorithm {
		return false
	}

	iterations, err := strconv.Atoi(parts[1])
	if err != nil || iterations < 1 || iterations > 1_000_000 {
		return false
	}

	salt, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || len(salt) == 0 {
		return false
	}

	expected, err := base64.RawURLEncoding.DecodeString(parts[3])
	if err != nil || len(expected) == 0 {
		return false
	}

	actual := pbkdf2SHA256([]byte(password), salt, iterations, len(expected))
	return subtle.ConstantTimeCompare(actual, expected) == 1
}

func pbkdf2SHA256(password, salt []byte, iterations, length int) []byte {
	hashLength := sha256.Size
	blocks := (length + hashLength - 1) / hashLength
	derived := make([]byte, 0, blocks*hashLength)

	var counter [4]byte
	for block := 1; block <= blocks; block++ {
		counter[0] = byte(block >> 24)
		counter[1] = byte(block >> 16)
		counter[2] = byte(block >> 8)
		counter[3] = byte(block)

		mac := hmac.New(sha256.New, password)
		mac.Write(salt)
		mac.Write(counter[:])
		u := mac.Sum(nil)

		t := make([]byte, len(u))
		copy(t, u)

		for round := 1; round < iterations; round++ {
			mac = hmac.New(sha256.New, password)
			mac.Write(u)
			u = mac.Sum(nil)
			for i := range t {
				t[i] ^= u[i]
			}
		}

		derived = append(derived, t...)
	}

	return derived[:length]
}

// NewSessionToken returns a random bearer token and its SHA-256 hash. Only the
// hash is stored in the database, so a database leak does not expose sessions.
func NewSessionToken() (token string, tokenHash string, err error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", "", fmt.Errorf("generate session token: %w", err)
	}

	token = base64.RawURLEncoding.EncodeToString(raw)
	return token, HashSessionToken(token), nil
}

// HashSessionToken deterministically hashes a bearer token for lookup.
func HashSessionToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

// NormalizeEmail lowercases and trims an email address.
func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// ValidateEmail performs a deliberately small sanity check; the address is not
// verified, only guaranteed to be a single plausible mailbox.
func ValidateEmail(email string) error {
	email = strings.TrimSpace(email)
	if email == "" {
		return errors.New("Укажите email")
	}
	if len(email) > 254 {
		return errors.New("Email слишком длинный")
	}

	at := strings.LastIndex(email, "@")
	if at <= 0 || at == len(email)-1 {
		return errors.New("Email выглядит некорректно")
	}
	if strings.ContainsAny(email, " \t\r\n") {
		return errors.New("Email не должен содержать пробелы")
	}
	if !strings.Contains(email[at+1:], ".") {
		return errors.New("Email выглядит некорректно")
	}

	return nil
}
