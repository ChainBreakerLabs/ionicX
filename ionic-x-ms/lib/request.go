package lib

import (
	"bytes"
	"encoding/json"
	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
	"github.com/mitchellh/mapstructure"
	"io"
)

// Bind is a function designed to bind request data to a struct. It combines path parameters,
// query parameters, and the request body into a single map, then decodes this data into the
// specified destination struct. Finally, it validates the struct using a custom validator.
//
// Parameters:
//   - c (echo.Context): The Echo context, which provides access to request data and methods
//     to interact with the request and response.
//   - dest (interface{}): The destination struct where the combined request data will be bound.
//
// Returns:
// - error: Returns an error if any of the steps (reading request data, decoding, or validation) fail.
func Bind(c echo.Context, dest interface{}) error {
	combinedMap := make(map[string]interface{})

	// Extract path parameters
	for _, name := range c.ParamNames() {
		combinedMap[name] = c.Param(name)
	}

	// Extract query parameters
	queryParams := c.QueryParams()
	for name, values := range queryParams {
		if len(values) > 0 {
			combinedMap[name] = values[0]
		}
	}

	// Extract request body
	if c.Request().Body != nil {
		bodyBytes, err := io.ReadAll(c.Request().Body)
		if err != nil {
			return err
		}

		c.Request().Body = io.NopCloser(bytes.NewReader(bodyBytes))

		if len(bodyBytes) > 0 {
			var bodyMap map[string]interface{}
			if err := json.Unmarshal(bodyBytes, &bodyMap); err != nil {
				return err
			}

			for k, v := range bodyMap {
				combinedMap[k] = v
			}
		}
	}

	config := &mapstructure.DecoderConfig{
		Metadata:         nil,
		Result:           dest,
		WeaklyTypedInput: true,
		TagName:          "json",
	}

	decoder, err := mapstructure.NewDecoder(config)
	if err != nil {
		return err
	}

	if err := decoder.Decode(combinedMap); err != nil {
		return err
	}

	return validator.New().Struct(dest)
}
