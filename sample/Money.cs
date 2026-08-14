namespace App.Sample
{
    public readonly struct Money
    {
        public Money(decimal amount) => Amount = amount;

        public decimal Amount { get; }
    }
}
