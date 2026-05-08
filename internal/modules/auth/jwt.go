package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type tokenIssuer struct {
	signingKey []byte
	ttl        time.Duration
}

type bearerClaims struct {
	TenantID  string `json:"tenant_id"`
	Role      string `json:"role"`
	ActorType string `json:"actor_type"`
	jwt.RegisteredClaims
}

func newTokenIssuer(signingKey string, ttl time.Duration) *tokenIssuer {
	return &tokenIssuer{
		signingKey: []byte(signingKey),
		ttl:        ttl,
	}
}

func (t *tokenIssuer) Issue(userID string, tenantID string, role string) (string, time.Time, error) {
	return t.IssueForActor(userID, tenantID, role, "user")
}

func (t *tokenIssuer) IssueForActor(subjectID string, tenantID string, role string, actorType string) (string, time.Time, error) {
	expiresAt := time.Now().UTC().Add(t.ttl)
	if actorType == "" {
		actorType = "user"
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, bearerClaims{
		TenantID:  tenantID,
		Role:      role,
		ActorType: actorType,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   subjectID,
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now().UTC()),
		},
	})

	signed, err := token.SignedString(t.signingKey)
	if err != nil {
		return "", time.Time{}, err
	}

	return signed, expiresAt, nil
}

func (t *tokenIssuer) Parse(rawToken string) (AuthClaims, error) {
	claims := bearerClaims{}

	token, err := jwt.ParseWithClaims(rawToken, &claims, func(token *jwt.Token) (any, error) {
		if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, errors.New("unexpected signing method")
		}

		return t.signingKey, nil
	})
	if err != nil {
		return AuthClaims{}, err
	}

	if !token.Valid {
		return AuthClaims{}, errors.New("invalid token")
	}

	return AuthClaims{
		UserID:    claims.Subject,
		TenantID:  claims.TenantID,
		Role:      claims.Role,
		ActorType: claims.ActorType,
		ExpiresAt: claims.ExpiresAt.Time,
	}, nil
}
