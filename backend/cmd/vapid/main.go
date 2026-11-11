// Command vapid prints a fresh VAPID key pair for Web Push.
//
//	go run ./cmd/vapid
//
// Put the printed values into the backend environment:
//
//	VAPID_PUBLIC_KEY=...
//	VAPID_PRIVATE_KEY=...
//	VAPID_SUBJECT=mailto:you@example.com
package main

import (
	"fmt"
	"os"

	webpush "github.com/SherClockHolmes/webpush-go"
)

func main() {
	privateKey, publicKey, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		fmt.Fprintln(os.Stderr, "generate VAPID keys:", err)
		os.Exit(1)
	}

	fmt.Printf("VAPID_PUBLIC_KEY=%s\nVAPID_PRIVATE_KEY=%s\n", publicKey, privateKey)
}
