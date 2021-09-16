import { Subject, Subscription } from 'rxjs';
import { DatePipe } from '@angular/common';
import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit, ElementRef } from '@angular/core';
import { SelectionTableComponent } from 'src/app/shared/selection-table/selection-table.component';
import { FlexpartResult } from 'src/app/flexpart/flexpart-result';
import { FlexpartService } from '../flexpart.service';
import { MatDialog } from '@angular/material/dialog';
import { SelectionDialogComponent } from 'src/app/shared/selection-dialog/selection-dialog.component';
import { ApiService } from 'src/app/core/services/api.service';
import { map } from 'rxjs/operators';
import { FlexpartOutput } from '../flexpart-output';
import { ActivatedRoute, Router } from '@angular/router';

const columnInfo = [
    // {
    //     name: 'startDate',
    //     text: 'Start Date',
    //     width: 140,
    //     withPipe: { pipe: DatePipe, arg: ["YYYY-MM-dd @ HH:mm"] },
    //     sort: true
    // },
    // {
    //     name: 'endDate',
    //     text: 'End Date',
    //     width: 150,
    //     withPipe: { pipe: DatePipe, arg: ["YYYY-MM-dd @ HH:mm"] },
    //     sort: true
    // },
    // {
    //     name: 'dataDirname',
    //     text: 'Name',
    //     width: 60,
    // },
    {
        name: 'id',
        text: 'Result id',
        width: 60,
    },
]

@Component({
  selector: 'app-flexpart-plot',
  templateUrl: './flexpart-plot.component.html',
  styleUrls: ['./flexpart-plot.component.scss']
})
export class FlexpartPlotComponent implements OnInit, OnDestroy {

    @ViewChild('selectionTableRef') selectionTableRef: SelectionTableComponent<FlexpartResult>;
    // @ViewChild(FlexpartPlotFormComponent) plotFormComp: FlexpartPlotFormComponent;

    // displayedColumns = ['select', 'startDate', 'endDate',];
    displayedColumns = ['select', 'id'];
    columnInfo = columnInfo;

    fpOutput: FlexpartOutput;

    resultsSubscription: Subscription;

    constructor(
        // public dialog: MatDialog,
        private flexpartService: FlexpartService,
        private apiService: ApiService,
        private router: Router,
        private route: ActivatedRoute,
        ) {}

    ngOnInit(): void {
        // this.flexpartService.updateResults();
        // this.apiService.get('/flexpart/results').subscribe(res => console.log(res))
    }

    ngAfterViewInit() {
        // this.resultsSubscription = this.flexpartService.resultsSubject.subscribe(
        //     (results) => {
        //         results.forEach((result) => {
        //             if (!('description' in result)) {
        //                 result.description = {
        //                     "Dir name": result.dataDirname,
        //                     "Grid size (dx/dy)": `${result.dx}/${result.dy}`,
        //                     // "Nbr of particles": 
        //                 }
        //             }
        //         })
        //         this.selectionTableRef.populateTable(results);
        //     }
        // )
        // this.resultsSubscription = this.flexpartService.getResults()
        //     .pipe(map((result:FlexpartResult) => {
        //         debugger
        //         this.selectionTableRef.dataSource.data.push(result)
        //     })

        // ).subscribe()
        this.resultsSubscription = this.flexpartService.getResults().subscribe((results: FlexpartResult[]) => {
            results.filter(result => result.outputs !== undefined);
            this.selectionTableRef.populateTable(results);
        })
    }

    emitSelection(fpResult: FlexpartResult) {
        if (fpResult) {
            // this.router.navigate([fpResult.id], { 
            //     relativeTo: this.route,
            //     state: {
            //         fpResult
            //     }
            // })
            this.router.navigate(['flexpart', 'results', fpResult.id], { 
                // state: {
                //     fpResult
                // }
            })
        } else {
            this.router.navigate(['flexpart', 'results'])
        }
        // if (fpResult.outputs.length == 1) {
        //     this.fpOutput = fpResult.outputs[0];
        //     this.fpOutput.resultId = fpResult.id;
        // } else {
        //     this.openDialog(fpResult);
        // }
    }

    // openDialog(key: any[], toReturn: any[]) {
    //     const dialogRef = this.dialog.open(SelectionDialogComponent, {
    //         data: {
    //             title: 'Select a NetCDF file :',
    //             items: key.map((e, i) => { return {dataKey: e, value: toReturn[i]} })
    //         }
    //     });

    //     dialogRef.afterClosed().subscribe(result => {
    //         this.fpOutput = result;
    //         this.fpOutput.resultId = result.id;
    //     })
    // }

    // openDialog(fpResult: FlexpartResult) {
    //     const dialogRef = this.dialog.open(SelectionDialogComponent, {
    //         data: {
    //             title: 'Select a NetCDF file :',
    //             items: fpResult.outputs.map(output => { return {dataKey: output.id, value: output} })
    //         }
    //     });

    //     dialogRef.afterClosed().subscribe(result => {
    //         this.fpOutput = result;
    //         this.fpOutput.resultId = fpResult.id;
    //     })
    // }

    ngOnDestroy() {
        this.resultsSubscription.unsubscribe();
    }
}
