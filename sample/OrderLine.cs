namespace App.Sample;

public record struct OrderLine(string Sku, int Quantity, decimal Price)
{
    public decimal Total => Quantity * Price;
}
