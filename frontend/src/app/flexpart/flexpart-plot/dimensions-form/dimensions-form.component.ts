import { MapPlotAction } from 'src/app/core/state/map-plot.state';
import { GeoJsonSliceResponse } from './../../../core/api/models/geo-json-slice-response';
import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable, of } from 'rxjs';
import { DropdownQuestion } from 'src/app/shared/form/dropdown-question';
import { QuestionBase } from 'src/app/shared/form/question-base';
import { FlexpartService } from '../../flexpart.service';
import { Store } from '@ngxs/store';
import { switchMap } from 'rxjs/operators';

@Component({
    selector: 'app-dimensions-form',
    templateUrl: './dimensions-form.component.html',
    styleUrls: ['./dimensions-form.component.scss'],
    providers:  [FlexpartService]
})
export class DimensionsFormComponent {

    formGroup: FormGroup;
    dimensions: Map<string, any[]>;

    questions$: Observable<QuestionBase<any>[]>;
    
    dimNames: string[] = [];
    dimValues: any[];

    dimForm: FormGroup;

    constructor(
        private route: ActivatedRoute,
        private flexpartService: FlexpartService,
        private store: Store
    ) {
        this.formGroup = new FormGroup({});
        this.questions$ = this.route.paramMap.pipe(
            switchMap(params => {
                const outputId = params.get('outputId');
                const layerName = params.get('layerName');
                return this.flexpartService.getDimsQuestions(outputId as string, layerName as string);
            })
        )
     }

     onSubmit() {
        const params = this.route.snapshot.paramMap;
        const outputId = params.get('outputId');
        const layerName = params.get('layerName');
        this.flexpartService.getSlice(outputId as string, layerName as string, this.formGroup.value.dimensions).subscribe(res => {
            const geores = res as GeoJsonSliceResponse;
            console.log(geores)
            this.store.dispatch(new MapPlotAction.Add(geores, 'flexpart'))
        });
     }

}