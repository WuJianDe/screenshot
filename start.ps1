param(
  [int]$Port = 8080
)

python -m http.server $Port
