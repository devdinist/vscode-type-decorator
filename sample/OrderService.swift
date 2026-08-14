import Foundation

/* 바깥 주석 /* 안쪽에 struct FakeOne { } */ 아직 주석이다 class FakeTwo { } */
final class OrderService {

    // protocol FakeThree { }
    private let pattern = #"enum FakeFour { case a }"#

    private let sql = """
        actor FakeFive { }
        """

    class func make() -> OrderService {
        OrderService()
    }

    func describe(_ name: String) -> String {
        "\(name) struct FakeSix { }"
    }
}
