<?php

namespace App\Tests\Unit;

use App\Service\StreetMerger;
use PHPUnit\Framework\TestCase;

final class StreetMergerTest extends TestCase
{
    private function street(array $plots = []): array
    {
        return [
            'id' => 'street-kalle',
            'name' => 'Bahnhofstraße',
            'city' => 'Tuttlingen',
            'ownerId' => 'player-kalle',
            'plots' => $plots ?: [
                ['id' => 'plot-1', 'size' => 'S', 'side' => 'left', 'index' => 0, 'price' => 500, 'purchasedAt' => 1, 'building' => ['name' => 'Kiosk']],
                ['id' => 'plot-2', 'size' => 'M', 'side' => 'left', 'index' => 1, 'price' => 1500],
                ['id' => 'plot-3', 'size' => 'L', 'side' => 'right', 'index' => 0, 'price' => 4000],
            ],
        ];
    }

    private function plot(array $street, string $id): array
    {
        foreach ($street['plots'] as $plot) {
            if ($plot['id'] === $id) {
                return $plot;
            }
        }
        self::fail("Grundstück $id fehlt");
    }

    private function withPlot(array $street, string $id, array $changes): array
    {
        foreach ($street['plots'] as $i => $plot) {
            if ($plot['id'] === $id) {
                $street['plots'][$i] = $changes + $plot;
            }
        }

        return $street;
    }

    public function testVisitorBuysAFreePlot(): void
    {
        $current = $this->street();
        $incoming = $this->withPlot($current, 'plot-2', ['purchasedAt' => 5, 'ownerId' => 'player-zoe']);

        $merged = (new StreetMerger())->merge($current, $incoming, 'player-zoe', false);

        self::assertSame('player-zoe', $this->plot($merged, 'plot-2')['ownerId']);
        self::assertSame('player-zoe', StreetMerger::plotOwner($this->plot($merged, 'plot-2'), 'player-kalle'));
    }

    public function testFirstBuyerWins(): void
    {
        $current = $this->withPlot($this->street(), 'plot-2', ['purchasedAt' => 5, 'ownerId' => 'player-zoe']);
        $incoming = $this->withPlot($this->street(), 'plot-2', ['purchasedAt' => 6, 'ownerId' => 'player-max']);

        $merged = (new StreetMerger())->merge($current, $incoming, 'player-max', false);

        self::assertSame('player-zoe', $this->plot($merged, 'plot-2')['ownerId']);
    }

    public function testVisitorCannotTouchOtherPlotsOrStreetFields(): void
    {
        $current = $this->street();
        $incoming = $this->withPlot($current, 'plot-1', ['building' => ['name' => 'Gekapert']]);
        $incoming['name'] = 'Zoestraße';
        $incoming['litter'] = [];

        $merged = (new StreetMerger())->merge($current, $incoming, 'player-zoe', false);

        self::assertSame($current, $merged);
    }

    public function testVisitorBuildsOnOwnPlot(): void
    {
        $current = $this->withPlot($this->street(), 'plot-2', ['purchasedAt' => 5, 'ownerId' => 'player-zoe']);
        $incoming = $this->withPlot($current, 'plot-2', ['building' => ['name' => 'Zoes Eisdiele'], 'price' => 1]);

        $plot = $this->plot((new StreetMerger())->merge($current, $incoming, 'player-zoe', false), 'plot-2');

        self::assertSame('Zoes Eisdiele', $plot['building']['name']);
        self::assertSame(1500, $plot['price'], 'Grundpreis bleibt');
    }

    public function testOwnerKeepsHandsOffForeignPlotsButEditsTheRest(): void
    {
        $current = $this->withPlot($this->street(), 'plot-2', ['purchasedAt' => 5, 'ownerId' => 'player-zoe', 'building' => ['name' => 'Zoes Eisdiele']]);
        // Kalles Client kennt Zoes Kauf noch nicht (alter Stand) und baut auf Grundstück 3.
        $incoming = $this->withPlot($this->street(), 'plot-3', ['purchasedAt' => 7, 'building' => ['name' => 'Kalles Burg']]);
        $incoming['litter'] = [['id' => 'l1', 'kind' => 'trash', 'pos' => 0.5, 'side' => 'top', 'taps' => 0]];

        $merged = (new StreetMerger())->merge($current, $incoming, 'player-kalle', true);

        self::assertSame('Zoes Eisdiele', $this->plot($merged, 'plot-2')['building']['name']);
        self::assertSame('Kalles Burg', $this->plot($merged, 'plot-3')['building']['name']);
        self::assertCount(1, $merged['litter']);
    }

    public function testOwnerCannotGiftPlots(): void
    {
        $current = $this->street();
        $incoming = $this->withPlot($current, 'plot-2', ['purchasedAt' => 5, 'ownerId' => 'player-zoe']);

        $plot = $this->plot((new StreetMerger())->merge($current, $incoming, 'player-kalle', true), 'plot-2');

        self::assertArrayNotHasKey('ownerId', $plot);
    }

    public function testUnknownPlotsAreIgnored(): void
    {
        $current = $this->street();
        $incoming = $current;
        $incoming['plots'][] = ['id' => 'plot-99', 'size' => 'L', 'side' => 'left', 'index' => 9, 'price' => 1];

        $merged = (new StreetMerger())->merge($current, $incoming, 'player-kalle', true);

        self::assertCount(3, $merged['plots']);
    }
}
