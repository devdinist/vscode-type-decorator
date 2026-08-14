import Foundation

protocol OrderRepository {
    func findById(_ id: Int) -> String?
}
