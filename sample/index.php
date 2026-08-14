<h1>class FakeOne { }</h1>
<?php

// 타입 선언이 없는 템플릿 파일 — 배지가 붙지 않아야 한다.
$orders = ['a', 'b'];

foreach ($orders as $order) {
    echo $order;
}

?>
<div>trait FakeTwo { }</div>
