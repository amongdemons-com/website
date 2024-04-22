<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

$endpoint = "https://constellations-api.mainnet.stargaze-apis.com/graphql";
// $authToken = "[[your auth token]]";//this is provided by graphcms
$qry = '{"query":"query Sales {\n  events(\n    filter: SALES\n    dataFilters: [\n      {\n        name: \"collection\"\n        value: \"stars1avp0vggx4ke9pnxpkv8f3g7uddl2rmjwnzme9qx7cask2788wa3s7hesgp\"\n        operator: EQUAL\n      }\n    ]\n    sortBy: BLOCK_HEIGHT_DESC\n    first: 18\n  ) {\n    edges {\n      node {\n        eventName\n        action\n        createdAt\n        data\n      }\n    }\n  }\n}\n"}';

$headers = array();
$headers[] = 'Content-Type: application/json';
// $headers[] = 'Authorization: Bearer '.$authToken;
$ch = curl_init();

curl_setopt($ch, CURLOPT_URL, $endpoint);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 0);
curl_setopt($ch, CURLOPT_POSTFIELDS, $qry);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$result = curl_exec($ch);
$result = json_decode($result);
$result->updated = time();
$result = json_encode($result);

file_put_contents("latest-transactions.js", $result);

if (curl_errno($ch)) {
    echo 'Error:' . curl_error($ch);
} else echo 'nft-latest-transactions.js updated.';
?>