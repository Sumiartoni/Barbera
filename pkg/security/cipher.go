package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
)

func EncryptString(plainText string, base64Key string) (string, error) {
	aead, err := newGCM(base64Key)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	cipherText := aead.Seal(nonce, nonce, []byte(plainText), nil)
	return base64.StdEncoding.EncodeToString(cipherText), nil
}

func DecryptString(cipherText string, base64Key string) (string, error) {
	aead, err := newGCM(base64Key)
	if err != nil {
		return "", err
	}

	rawCipherText, err := base64.StdEncoding.DecodeString(cipherText)
	if err != nil {
		return "", err
	}

	nonceSize := aead.NonceSize()
	if len(rawCipherText) < nonceSize {
		return "", errors.New("cipher text too short")
	}

	nonce, payload := rawCipherText[:nonceSize], rawCipherText[nonceSize:]
	plainText, err := aead.Open(nil, nonce, payload, nil)
	if err != nil {
		return "", err
	}

	return string(plainText), nil
}

func newGCM(base64Key string) (cipher.AEAD, error) {
	key, err := base64.StdEncoding.DecodeString(base64Key)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	return cipher.NewGCM(block)
}
