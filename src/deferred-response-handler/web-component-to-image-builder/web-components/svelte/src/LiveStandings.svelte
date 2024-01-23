<!--<svelte:options tag="live-standings"/>-->

<script>
    export let liveStandingsAsJSON = '{}';

    const fallbackImageUrl = 'https://image.emojipng.com/938/10482938.jpg';
    const liveStandingsMetadata = JSON.parse(liveStandingsAsJSON);
    const liveStandingsByTeam = Object.entries(liveStandingsMetadata).map(([_, singleTeamsStandingData]) => singleTeamsStandingData);
    const sortedStandings = liveStandingsByTeam.sort((teamStandingObjectA, teamStandingObjectB) => {
        const teamARank = Number((teamStandingObjectA).rank);
        const teamBRank = Number((teamStandingObjectB).rank);
        return (teamARank < teamBRank)
            ? -1 // order teamA first
            : 1 // order teamB first
    });
</script>

<div class="live-standings-background">
    <table>
        <tr>
            <th class="header table-cell-pad-bottom">Rank</th>
            <th class="header table-cell-pad-bottom" style="float: left">Team</th>
            <th class="header table-cell-pad-bottom">Win Percentage</th>
            <th class="header table-cell-pad-bottom">W/L/D</th>
        </tr>
        {#each sortedStandings as { teamKey, teamName, rank, wins, losses, ties, winPercentage, teamLogoUrl }, i (teamKey)}
            <tr>
                <td class={i === 6 ? "table-cell-pad-bottom table-cell-pad-top team-rank" : "table-cell-pad-bottom team-rank"}>{(rank < 10) ? `0${rank}` : rank}</td>
                <td class={i === 6 ? "table-cell-pad-bottom table-cell-pad-top" : "table-cell-pad-bottom"}>
                    <div class="flex-row">
                        <img  class="team-icon" src="{teamLogoUrl}" alt="{fallbackImageUrl}"/>
                        <span class="team-name">{teamName}</span>
                    </div>
                </td>
                <td class={i === 6 ? "win-percentage table-cell-pad-bottom table-cell-pad-top" : "win-percentage table-cell-pad-bottom"}>{winPercentage}%</td>
                <td class={i === 6 ? "team-record table-cell-pad-bottom table-cell-pad-top" : "team-record table-cell-pad-bottom"}>{wins}-{losses}-{ties}</td>
            </tr>
            {#if i === 5}
                <tr>
                    <td class="playoff-divider"></td>
                    <td class="playoff-divider"></td>
                    <td class="playoff-divider"></td>
                    <td class="playoff-divider"></td>
                </tr>
            {/if}
        {/each}
    </table>
</div>

<style>
    table {
        width: 100%;
    }
    .table-cell-pad-bottom {
        padding-bottom: 6px;
    }
    .table-cell-pad-top {
        padding-top: 6px;
    }
    .live-standings-background {
        background-color: #2f3136;
        border: 1px solid #2f3136;
        height: 100%;
        padding: 10px;
    }
    .flex-row {
        display: flex;
        flex-direction: row;
        align-items: center;
    }
    .header {
        color: floralwhite;
        font-size: 16px;
    }
    .team-rank {
        color: floralwhite;
        font-size: 18px;
        font-weight: bold;
        text-align: center;
    }
    .team-icon {
        border: 1px solid #856643;
        border-radius: 50%;
        height: 32px;
        width: 32px;
        margin-right: 20px;
    }
    .team-name {
        color: #a88c61;
        font-size: 16px;
        font-weight: bold;
        padding-left: 10px;
        padding-right: 10px;
    }
    .win-percentage {
        color: #f6f0c1;
        font-size: 16px;
        font-weight: bold;
        text-align: center;
    }
    .team-record {
        color: #f6f0c1;
        font-size: 16px;
        font-weight: bold;
        text-align: center;
    }
    .playoff-divider {
        border-bottom: 2px dashed red;
    }
</style>