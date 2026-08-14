import Foundation

actor OrderCoordinator {
    private var pending: [String] = []

    func enqueue(_ sku: String) {
        pending.append(sku)
    }
}
