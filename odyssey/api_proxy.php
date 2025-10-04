<?php
// odyssey/api_proxy.php
header('Content-Type: application/json');

// Simple rate limit per IP (very small, in-memory file). For production use a better store.
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateDir = __DIR__ . '/.rate';
if (!is_dir($rateDir)) @mkdir($rateDir,0700,true);
$rateFile = $rateDir . '/' . preg_replace('/[^a-z0-9\._-]/i','_',$ip);
$limit = 20; // requests per window
$window = 60; // seconds
$now = time();
$counts = ['ts'=>$now, 'count'=>0];
if (file_exists($rateFile)) {
  $raw = @file_get_contents($rateFile);
  $tmp = @json_decode($raw, true);
  if (is_array($tmp)) $counts = $tmp;
}
if ($now - ($counts['ts'] ?? 0) > $window) {
  $counts = ['ts'=>$now, 'count'=>0];
}
$counts['count'] = ($counts['count'] ?? 0) + 1;
file_put_contents($rateFile, json_encode($counts));
if ($counts['count'] > $limit) {
  http_response_code(429);
  echo json_encode(['error'=>'rate_limited','message'=>'Too many requests. Try again later.']);
  exit;
}

// read body
$body = file_get_contents('php://input');
if (!$body) {
  http_response_code(400);
  echo json_encode(['error'=>'empty_request']);
  exit;
}
$data = json_decode($body, true);
if (!$data) {
  http_response_code(400);
  echo json_encode(['error'=>'invalid_json']);
  exit;
}

// get API key: env var preferred, otherwise odyssey/openai_key.php
$apiKey = getenv('OPENAI_API_KEY');
if (!$apiKey && file_exists(__DIR__ . '/openai_key.php')) {
    $k = include __DIR__ . '/openai_key.php';
    if (is_string($k)) $apiKey = $k;
}
if (!$apiKey) {
  http_response_code(500);
  echo json_encode(['error'=>'missing_api_key','message'=>'Set OPENAI_API_KEY env or create odyssey/openai_key.php']);
  exit;
}

// basic validation & guardrails
$messages = $data['messages'] ?? null;
$model = $data['model'] ?? 'gpt-4';
if (!$messages || !is_array($messages)) {
  http_response_code(400);
  echo json_encode(['error'=>'messages_required']);
  exit;
}
// limit size to avoid huge requests
$rawLen = strlen(json_encode($messages));
$maxLen = 50000; // adjust as needed
if ($rawLen > $maxLen) {
  http_response_code(400);
  echo json_encode(['error'=>'messages_too_large','details'=>"messages JSON length $rawLen > $maxLen"]);
  exit;
}

// forward to OpenAI Chat Completions
$payload = [
  'model' => $model,
  'messages' => $messages,
  // you can add max_tokens/temperature here if you want defaults
];

$ch = curl_init('https://api.openai.com/v1/chat/completions');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'Content-Type: application/json',
  'Authorization: Bearer ' . $apiKey
]);
$response = curl_exec($ch);
$err = curl_error($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($err) {
  http_response_code(500);
  echo json_encode(['error'=>'curl_error','details'=>$err]);
  exit;
}
http_response_code($code ?: 200);
echo $response;
