import Foundation

struct Money {
    let amount: Decimal

    // 중첩 타입은 최상위로 세지 않는다.
    enum Currency {
        case krw
        case usd
    }
}
