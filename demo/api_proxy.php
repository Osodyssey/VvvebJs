<?php
// api_proxy.php
// قرار بده در ریشه پروژه یا demo/
// روش خواندن کلید: اول از متغیر محیطی OPENAI_API_KEY و در صورت نبود از openai_key.php استفاده می‌کند.

header('Content-Type: application/json');

// Read raw POST body
$body = file_get_contents('php://input');
if (!$body) {
  http_response_code(400);
  echo json_encode(['error' => 'empty_request']);
  exit;
}

$data = json_decode($body, true);
if (!$data) {
  http_response_code(400);
  echo json_encode(['error' => 'invalid_json']);
  exit;
}

// get api key (prefer env var)
$apiKey = getenv('OPENAI_API_KEY');
if (!$apiKey && file_exists(__DIR__ . '/openai_key.php')) {
  // openai_key.php should return an array: <?php return 'sk-xxxx'; 
  $k = include __DIR__ . '/openai_key.php';
  if (is_string($k)) $apiKey = $k;
}

if (!$apiKey) {
  http_response_code(500);
  echo json_encode(['error' => 'missing_api_key', 'message' => 'Set OPENAI_API_KEY env or create openai_key.php']);
  exit;
}

// validate messages
$messages = $data['messages'] ?? null;
$model = $data['model'] ?? 'gpt-4';
if (!$messages || !is_array($messages)) {
  http_response_code(400);
  echo json_encode(['error' => 'messages_required']);
  exit;
}

// build request to OpenAI Chat Completions
$payload = [
  'model' => $model,
  'messages' => $messages,
  // 'max_tokens' => 800,
  // 'temperature' => 0.7,
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
  echo json_encode(['error' => 'curl_error', 'details' => $err]);
  exit;
}

// پاس‌ داده شده به فرانت‌اند (forward raw response)
http_response_code($code ?: 200);
echo $response;
